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
import { gradeConfigurationRepository } from '../repositories/grade-configuration.repository.js';
import { AppError } from '../utils/app-error.js';
import {
  calculateOverallAverage,
  calculateRequiredGrade,
  calculateWeightedAverage,
  roundGrade,
  toGradeLikes,
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
    gradeComponent: row.gradeComponent,
    label: row.label,
    value: row.value,
    maxValue: row.maxValue,
    normalized: normalize(row.value, row.maxValue),
    gradedAt: row.gradedAt.toISOString(),
    notes: row.notes,
    subject: row.subject,
    exam: row.exam
      ? { id: row.exam.id, title: row.exam.title, date: row.exam.date.toISOString() }
      : null,
    createdAt: row.createdAt.toISOString(),
    isFinal: row.isFinal,
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
   * O peso restante vem dos COMPONENTES CONFIGURADOS sem nota - dado real, e
   * nao a suposicao de que o semestre soma peso 10. Sem uma configuracao de
   * notas (ou sem componentes pendentes), `remainingWeight` fica null e
   * nenhuma projecao e inventada.
   *
   * Esta e a UNICA implementacao do calculo (Etapa 17) - antes dela o
   * detalhe da disciplina tinha sua propria estimativa, que podia divergir
   * deste numero para a mesma disciplina.
   */
  async getSubjectSummary(userId: string, subjectId: string): Promise<SubjectGradeSummary> {
    const subject = await subjectRepository.findById(userId, subjectId);

    if (!subject) throw AppError.notFound('Disciplina');

    const [rows, config] = await Promise.all([
      gradeRepository.findBySubject(userId, subjectId),
      gradeConfigurationRepository.findBySubject(userId, subjectId),
    ]);

    const passingGrade = config?.passingGrade ?? 6;

    // Uma nota nao-final (`isFinal: false` - mais pontos ainda vao somar,
    // Etapa 18) fica visivel em `grades`, mas nao fecha o componente: ele
    // continua contando como pendente na media/nota necessaria, exatamente
    // como um componente sem nota nenhuma.
    const finalRows = rows.filter((row) => row.isFinal);
    const gradedComponentIds = new Set(finalRows.map((row) => row.gradeComponent.id));
    const pendingComponents = (config?.components ?? []).filter(
      (component) => !gradedComponentIds.has(component.id),
    );

    const grades = rows.map(toListItem);
    const gradeLikes = toGradeLikes(finalRows);

    const usedWeight = gradeLikes.reduce((total, grade) => total + (grade.weight || 1), 0);
    const remainingWeight =
      pendingComponents.length > 0
        ? pendingComponents.reduce((total, component) => total + component.weight, 0)
        : null;

    // O peso restante conta no denominador da media, sem inventar nota para
    // ele: uma prova futura sem nota lancada nao pode "fechar" a media como
    // se valesse zero (ver a explicacao em `calculateWeightedAverage`).
    const average = calculateWeightedAverage(gradeLikes, usedWeight + (remainingWeight ?? 0));

    const requiredGrade =
      average !== null && remainingWeight !== null && remainingWeight > 0
        ? calculateRequiredGrade(gradeLikes, passingGrade, remainingWeight)
        : null;

    return {
      subject: {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        passingGrade,
      },
      grades,
      average,
      usedWeight: roundGrade(usedWeight),
      remainingWeight: remainingWeight === null ? null : roundGrade(remainingWeight),
      requiredGrade,
      status: resolveStatus(average, passingGrade, requiredGrade, remainingWeight),
      pendingComponents: pendingComponents.map((component) => ({
        id: component.id,
        name: component.name,
        weight: component.weight,
      })),
    };
  },

  /** Boletim de todas as disciplinas em andamento, opcionalmente recortado por semestre. */
  async getOverview(userId: string, semesterId?: string): Promise<GradesOverview> {
    const subjects = await subjectRepository.findActiveWithGrades(userId, semesterId);

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
    await this.assertComponentAvailable(userId, input.subjectId, input.gradeComponentId);

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
      gradeComponentId: input.gradeComponentId,
      label: emptyToNull(input.label),
      value: input.value,
      maxValue: input.maxValue,
      examId: input.examId ?? null,
      gradedAt: input.gradedAt ?? new Date(),
      notes: emptyToNull(input.notes),
      isFinal: input.isFinal,
    });

    return toListItem(row);
  },

  async update(userId: string, id: string, input: UpdateGradeInput): Promise<GradeListItem> {
    const current = await gradeRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Nota');

    if (input.subjectId) await assertSubject(userId, input.subjectId);

    if (input.gradeComponentId) {
      await this.assertComponentAvailable(
        userId,
        input.subjectId ?? current.subject.id,
        input.gradeComponentId,
      );
    }

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
      ...(input.gradeComponentId !== undefined ? { gradeComponentId: input.gradeComponentId } : {}),
      ...(input.label !== undefined ? { label: emptyToNull(input.label) } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.maxValue !== undefined ? { maxValue: input.maxValue } : {}),
      ...(input.examId !== undefined ? { examId: input.examId ?? null } : {}),
      ...(input.gradedAt !== undefined ? { gradedAt: input.gradedAt } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
      ...(input.isFinal !== undefined ? { isFinal: input.isFinal } : {}),
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

  /** Confirma que o componente pertence a configuracao de notas da disciplina. */
  async assertComponentAvailable(
    userId: string,
    subjectId: string,
    gradeComponentId: string,
  ): Promise<void> {
    const config = await gradeConfigurationRepository.findBySubject(userId, subjectId);
    const exists = config?.components.some((component) => component.id === gradeComponentId);

    if (!exists) {
      throw AppError.badRequest('Componente de avaliação inválido para esta disciplina');
    }
  },
};
