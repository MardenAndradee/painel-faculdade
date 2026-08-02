import type {
  CreateGradeInput,
  GradeListItem,
  GradesOverview,
  SubjectGradeStatus,
  SubjectGradeSummary,
  UpdateGradeInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import { gradeRepository, type GradeRow } from '../repositories/grade.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { AppError } from '../utils/app-error.js';
import {
  calculateOverallAverage,
  calculateRequiredGrade,
  calculateWeightedAverage,
  roundGrade,
} from '../utils/grade-calculator.js';
import { emptyToNull } from '../utils/text.js';

/** Regra de negocio de notas. */

/** Converte a nota para a escala 0-10, que e como a media e calculada. */
function normalize(value: number, maxValue: number): number {
  const scale = maxValue > 0 ? maxValue : 10;

  return roundGrade((value / scale) * 10);
}

function toListItem(row: GradeRow): GradeListItem {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    value: row.value,
    maxValue: row.maxValue,
    weight: row.weight,
    normalized: normalize(row.value, row.maxValue),
    gradedAt: row.gradedAt.toISOString(),
    notes: row.notes,
    subject: row.subject,
    exam: row.exam
      ? { id: row.exam.id, title: row.exam.title, date: row.exam.date.toISOString() }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Situacao da disciplina.
 *
 * "Atenção" cobre o caso em que a aprovacao ainda e possivel, mas exige nota
 * alta no restante - o aviso mais util que o sistema pode dar.
 */
function resolveStatus(
  average: number | null,
  passingGrade: number,
  requiredGrade: number | null,
  remainingWeight: number | null,
): SubjectGradeStatus {
  if (average === null) return 'SEM_NOTAS';

  // Sem peso restante conhecido, a media atual e o resultado final.
  if (remainingWeight === null || remainingWeight === 0) {
    return average >= passingGrade ? 'APROVADO' : 'REPROVADO';
  }

  if (requiredGrade === null) return 'EM_ANDAMENTO';

  // Ja garantiu: mesmo zerando o restante, a media se sustenta.
  if (requiredGrade <= 0) return 'APROVADO';

  // Impossivel: nem com nota maxima no restante alcanca a media.
  if (requiredGrade > 10) return 'REPROVADO';

  // Precisa de mais de 70% da escala no que falta.
  return requiredGrade >= 7 ? 'EM_RECUPERACAO' : 'EM_ANDAMENTO';
}

/** Confirma que a disciplina pertence ao usuario. */
async function assertSubject(userId: string, subjectId: string): Promise<void> {
  const subject = await subjectRepository.findById(userId, subjectId);

  if (!subject) throw AppError.badRequest('Disciplina inválida');
}

export const gradeService = {
  /**
   * Boletim de uma disciplina.
   *
   * O peso restante vem das PROVAS CADASTRADAS sem nota - dado real, e nao a
   * suposicao de que o semestre soma peso 10. Quando nao ha provas pendentes,
   * `remainingWeight` fica null e nenhuma projecao e inventada.
   */
  async getSubjectSummary(userId: string, subjectId: string): Promise<SubjectGradeSummary> {
    const subject = await subjectRepository.findById(userId, subjectId);

    if (!subject) throw AppError.notFound('Disciplina');

    const [rows, pendingExams] = await Promise.all([
      gradeRepository.findBySubject(userId, subjectId),
      gradeRepository.findExamsWithoutGrade(userId, subjectId),
    ]);

    const grades = rows.map(toListItem);
    const average = calculateWeightedAverage(rows);

    const usedWeight = rows.reduce((total, row) => total + (row.weight || 1), 0);
    const remainingWeight =
      pendingExams.length > 0
        ? pendingExams.reduce((total, exam) => total + (exam.weight || 1), 0)
        : null;

    const requiredGrade =
      average !== null && remainingWeight !== null && remainingWeight > 0
        ? calculateRequiredGrade(rows, subject.passingGrade, remainingWeight)
        : null;

    return {
      subject: {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        passingGrade: subject.passingGrade,
      },
      grades,
      average,
      usedWeight: roundGrade(usedWeight),
      remainingWeight: remainingWeight === null ? null : roundGrade(remainingWeight),
      requiredGrade,
      status: resolveStatus(average, subject.passingGrade, requiredGrade, remainingWeight),
      pendingExams: pendingExams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        date: exam.date.toISOString(),
        weight: exam.weight,
      })),
    };
  },

  /** Boletim de todas as disciplinas em andamento. */
  async getOverview(userId: string): Promise<GradesOverview> {
    const subjects = await subjectRepository.findActiveWithGrades(userId);

    const summaries = await Promise.all(
      subjects.map((subject) => this.getSubjectSummary(userId, subject.id)),
    );

    return {
      subjects: summaries,
      overallAverage: calculateOverallAverage(summaries.map((item) => item.average)),
      totalGrades: summaries.reduce((total, item) => total + item.grades.length, 0),
      subjectsAtRisk: summaries.filter(
        (item) => item.status === 'EM_RECUPERACAO' || item.status === 'REPROVADO',
      ).length,
    };
  },

  async list(userId: string, subjectId?: string): Promise<GradeListItem[]> {
    const rows = subjectId
      ? await gradeRepository.findBySubject(userId, subjectId)
      : await gradeRepository.findAll(userId);

    return rows.map(toListItem);
  },

  async create(userId: string, input: CreateGradeInput): Promise<GradeListItem> {
    await assertSubject(userId, input.subjectId);

    if (input.examId) {
      await this.assertExamAvailable(userId, input.examId);
    }

    if (input.value > input.maxValue) {
      throw AppError.badRequest('A nota não pode ser maior que a escala', {
        value: [`A nota não pode passar de ${input.maxValue}`],
      });
    }

    const row = await gradeRepository.create(userId, {
      subjectId: input.subjectId,
      type: input.type,
      label: emptyToNull(input.label),
      value: input.value,
      maxValue: input.maxValue,
      weight: input.weight,
      examId: input.examId ?? null,
      gradedAt: input.gradedAt ?? new Date(),
      notes: emptyToNull(input.notes),
    });

    return toListItem(row);
  },

  async update(userId: string, id: string, input: UpdateGradeInput): Promise<GradeListItem> {
    const current = await gradeRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Nota');

    if (input.subjectId) await assertSubject(userId, input.subjectId);

    if (input.examId) {
      await this.assertExamAvailable(userId, input.examId, id);
    }

    // A validacao cruzada usa os valores atuais quando so um dos campos vem.
    const value = input.value ?? current.value;
    const maxValue = input.maxValue ?? current.maxValue;

    if (value > maxValue) {
      throw AppError.badRequest('A nota não pode ser maior que a escala', {
        value: [`A nota não pode passar de ${maxValue}`],
      });
    }

    const data: Prisma.GradeUncheckedUpdateInput = {
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.label !== undefined ? { label: emptyToNull(input.label) } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.maxValue !== undefined ? { maxValue: input.maxValue } : {}),
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      ...(input.examId !== undefined ? { examId: input.examId ?? null } : {}),
      ...(input.gradedAt !== undefined ? { gradedAt: input.gradedAt } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
    };

    const row = await gradeRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Nota');

    return toListItem(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await gradeRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Nota');
  },

  /**
   * Impede duas notas para a mesma prova.
   *
   * A relacao e 1-1 no schema; sem esta checagem o erro viria do banco como
   * violacao de constraint, sem mensagem util para o usuario.
   */
  async assertExamAvailable(
    userId: string,
    examId: string,
    excludeGradeId?: string,
  ): Promise<void> {
    const existing = await gradeRepository.findByExam(userId, examId, excludeGradeId);

    if (existing) {
      throw AppError.conflict('Esta prova já tem uma nota lançada');
    }
  },
};
