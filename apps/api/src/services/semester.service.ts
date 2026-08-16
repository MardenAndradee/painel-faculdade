import {
  defaultSemesterDates,
  defaultSemesterName,
  getCurrentSemesterKey,
  type AcademicHistory,
  type CloseSemesterPreview,
  type HistorySemester,
  type HistorySubject,
  type SemesterKey,
  type SemesterListItem,
  type UpdateSemesterInput,
} from '@painel/shared';
import type { SubjectStatus } from '@painel/shared';
import {
  semesterRepository,
  type HistorySubjectRow,
  type SemesterRow,
} from '../repositories/semester.repository.js';
import { AppError } from '../utils/app-error.js';
import { gradeConfigurationService } from './grade-configuration.service.js';
import {
  calculateOverallAverage,
  calculateWeightedAverage,
  roundGrade,
  toGradeLikes,
  totalConfiguredWeight,
} from '../utils/grade-calculator.js';

/** Regra de negocio de semestres e historico. */

function toListItem(row: SemesterRow): SemesterListItem {
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    term: row.term,
    status: row.status,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    subjectCount: row._count.subjects,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Media de uma disciplina no historico.
 *
 * Semestre encerrado usa `finalGrade`, congelado no encerramento: editar uma
 * nota antiga nao pode reescrever o boletim de um periodo ja fechado.
 * Semestre em andamento calcula a partir das notas lancadas.
 */
function toHistorySubject(row: HistorySubjectRow): HistorySubject {
  const consolidated = row.finalGrade !== null;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    credits: row.credits,
    // Defensivo: toda disciplina ganha uma configuracao ao ser criada.
    passingGrade: row.gradeConfiguration?.passingGrade ?? 6,
    status: row.status,
    average: consolidated
      ? row.finalGrade
      : calculateWeightedAverage(
          toGradeLikes(row.grades),
          totalConfiguredWeight(row.gradeConfiguration?.components),
        ),
    isConsolidated: consolidated,
    gradeCount: row.grades.length,
    teacherName: row.teacher?.name ?? null,
  };
}

/** Creditos da disciplina; sem valor informado, conta como 1. */
function creditsOf(subject: HistorySubject): number {
  return subject.credits && subject.credits > 0 ? subject.credits : 1;
}

/**
 * Coeficiente de rendimento ponderado por creditos.
 *
 * Diferente da media geral do dashboard (media simples): aqui uma disciplina
 * de 6 creditos pesa o triplo de uma de 2 - e como a universidade calcula.
 * Apenas aprovadas entram: reprovadas e trancadas nao compoem o coeficiente.
 */
function calculateCr(subjects: HistorySubject[]): number | null {
  const eligible = subjects.filter(
    (subject) => subject.status === 'APPROVED' && subject.average !== null,
  );

  if (eligible.length === 0) return null;

  let weightedSum = 0;
  let totalCredits = 0;

  for (const subject of eligible) {
    const credits = creditsOf(subject);

    weightedSum += (subject.average ?? 0) * credits;
    totalCredits += credits;
  }

  if (totalCredits === 0) return null;

  return roundGrade(weightedSum / totalCredits);
}

/** Situacao que a disciplina recebera ao encerrar o semestre. */
function resolveFinalStatus(average: number | null, passingGrade: number): SubjectStatus {
  // Sem nota nao ha como decidir; a disciplina permanece como esta.
  if (average === null) return 'IN_PROGRESS';

  return average >= passingGrade ? 'APPROVED' : 'FAILED';
}

export const semesterService = {
  // --- CRUD ---------------------------------------------------------------------

  /**
   * Lista o historico de semestres.
   *
   * Garante o atual antes de ler (Decisao #1 da Etapa 31): usuario legado sem
   * nenhum semestre ainda nao fica com a tela vazia esperando uma criacao
   * manual que nao existe mais.
   */
  async list(userId: string): Promise<SemesterListItem[]> {
    await this.getOrCreateCurrent(userId);

    const rows = await semesterRepository.findAll(userId);

    return rows.map(toListItem);
  },

  async getById(userId: string, id: string): Promise<SemesterListItem> {
    const row = await semesterRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Semestre');

    return toListItem(row);
  },

  /**
   * Acha o semestre de `(ano, periodo)`, criando-o se ainda nao existir.
   *
   * Uso interno - nao ha mais criacao manual pela API (Etapa 31). Chamado
   * pelo bootstrap de usuario novo, pela resolucao do semestre atual e por
   * `resolveMemberSemester` (Turmas), que precisa do mesmo "acha-ou-cria" por
   * `(ano, periodo)` para o semestre PESSOAL de cada membro.
   */
  async ensure(userId: string, key: SemesterKey): Promise<SemesterListItem> {
    const existing = await semesterRepository.findByYearTerm(userId, key.year, key.term);

    if (existing) return this.getById(userId, existing.id);

    const data = {
      name: defaultSemesterName(key),
      year: key.year,
      term: key.term,
      status: 'ACTIVE' as const,
      ...defaultSemesterDates(key),
    };

    /**
     * Semestre novo ja nasce com um modelo de notas (Etapa 18).
     *
     * Sem isso, cada periodo comecava vazio e a pessoa reconfigurava N1/N2/N3
     * a mao - com o modelo pessoal parado ali do lado, que e exatamente o que
     * ele existe para evitar. Passar `null` como semestre resolve para o
     * modelo pessoal, sem cair em template de outro periodo.
     */
    const template = await gradeConfigurationService.resolveInitialConfiguration(userId, null);

    // Modelo sem componentes nao vira template: `findByTemplateSemester`
    // passaria a encontrar uma configuracao vazia e disciplinas novas
    // nasceriam sem componente nenhum, em vez de herdarem o modelo pessoal.
    const row =
      template.components.length > 0
        ? await semesterRepository.createWithGradeTemplate(userId, data, template)
        : await semesterRepository.create(userId, data);

    return toListItem(row);
  },

  /**
   * Semestre PESSOAL atual do usuario, calculado pela data de hoje.
   *
   * Rede de seguranca "sob demanda" (Decisao #1): chamada em todo caminho que
   * antes lia a flag `isCurrent`, garante que a resposta nunca vem vazia.
   */
  getOrCreateCurrent(userId: string): Promise<SemesterListItem> {
    return this.ensure(userId, getCurrentSemesterKey(new Date()));
  },

  /** Edicao: so o nome. Ano/periodo/datas sao a identidade do registro (Decisao #5). */
  async update(userId: string, id: string, input: UpdateSemesterInput): Promise<SemesterListItem> {
    const row = await semesterRepository.update(userId, id, { name: input.name });

    if (!row) throw AppError.notFound('Semestre');

    return toListItem(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await semesterRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Semestre');
  },

  // --- Encerramento -----------------------------------------------------------------

  /** Previa: mostra o que sera gravado antes de confirmar. */
  async previewClose(userId: string, id: string): Promise<CloseSemesterPreview> {
    const semester = await semesterRepository.findById(userId, id);

    if (!semester) throw AppError.notFound('Semestre');

    const rows = await semesterRepository.findSubjects(userId, id);
    const subjects = rows.map(toHistorySubject);

    return {
      semester: { id: semester.id, name: semester.name },
      subjects: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        average: subject.average,
        passingGrade: subject.passingGrade,
        resultingStatus: resolveFinalStatus(subject.average, subject.passingGrade),
      })),
      withoutGrades: subjects.filter((subject) => subject.average === null).length,
    };
  },

  /**
   * Encerra o semestre.
   *
   * Consolida a media de cada disciplina em `finalGrade` e grava a situacao.
   * Congelar e o ponto: sem isso, editar uma nota antiga reescreveria o
   * boletim de um periodo ja fechado.
   *
   * Disciplinas sem nota ficam sem media final e permanecem em andamento.
   */
  async close(userId: string, id: string): Promise<SemesterListItem> {
    const semester = await semesterRepository.findById(userId, id);

    if (!semester) throw AppError.notFound('Semestre');

    if (semester.status === 'FINISHED') {
      throw AppError.conflict('Este semestre já foi encerrado');
    }

    const rows = await semesterRepository.findSubjects(userId, id);

    for (const row of rows) {
      const subject = toHistorySubject(row);

      await semesterRepository.consolidateSubject(
        subject.id,
        subject.average,
        resolveFinalStatus(subject.average, subject.passingGrade),
      );
    }

    const updated = await semesterRepository.update(userId, id, { status: 'FINISHED' });

    if (!updated) throw AppError.notFound('Semestre');

    return toListItem(updated);
  },

  /**
   * Reabre um semestre encerrado.
   *
   * Limpa `finalGrade` para que as medias voltem a ser calculadas das notas -
   * do contrario o semestre reaberto continuaria exibindo valores congelados.
   */
  async reopen(userId: string, id: string): Promise<SemesterListItem> {
    const semester = await semesterRepository.findById(userId, id);

    if (!semester) throw AppError.notFound('Semestre');

    const rows = await semesterRepository.findSubjects(userId, id);

    for (const row of rows) {
      await semesterRepository.consolidateSubject(row.id, null, 'IN_PROGRESS');
    }

    const updated = await semesterRepository.update(userId, id, { status: 'ACTIVE' });

    if (!updated) throw AppError.notFound('Semestre');

    return toListItem(updated);
  },

  // --- Historico -------------------------------------------------------------------

  /**
   * Historico completo, agrupado por semestre.
   *
   * Uma consulta traz todas as disciplinas e o agrupamento acontece em
   * memoria - evita uma consulta por semestre.
   */
  async getHistory(userId: string): Promise<AcademicHistory> {
    await this.getOrCreateCurrent(userId);

    const [semesterRows, subjectRows] = await Promise.all([
      semesterRepository.findAll(userId),
      semesterRepository.findAllSubjects(userId),
    ]);

    const bySemester = new Map<string, HistorySubject[]>();
    const unassigned: HistorySubject[] = [];

    for (const row of subjectRows) {
      const subject = toHistorySubject(row);

      if (!row.semesterId) {
        unassigned.push(subject);
        continue;
      }

      bySemester.set(row.semesterId, [...(bySemester.get(row.semesterId) ?? []), subject]);
    }

    const semesters: HistorySemester[] = semesterRows.map((row) => {
      const subjects = bySemester.get(row.id) ?? [];

      const totalCredits = subjects.reduce((total, subject) => total + creditsOf(subject), 0);
      const earnedCredits = subjects
        .filter((subject) => subject.status === 'APPROVED')
        .reduce((total, subject) => total + creditsOf(subject), 0);

      return {
        id: row.id,
        name: row.name,
        year: row.year,
        term: row.term,
        status: row.status,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate.toISOString(),
        subjects,
        average: calculateOverallAverage(subjects.map((subject) => subject.average)),
        approvedCount: subjects.filter((subject) => subject.status === 'APPROVED').length,
        failedCount: subjects.filter((subject) => subject.status === 'FAILED').length,
        inProgressCount: subjects.filter((subject) => subject.status === 'IN_PROGRESS').length,
        totalCredits,
        earnedCredits,
      };
    });

    const allSubjects = [...subjectRows.map(toHistorySubject)];

    return {
      semesters,
      overallCr: calculateCr(allSubjects),
      totalCredits: allSubjects.reduce((total, subject) => total + creditsOf(subject), 0),
      earnedCredits: allSubjects
        .filter((subject) => subject.status === 'APPROVED')
        .reduce((total, subject) => total + creditsOf(subject), 0),
      approvedSubjects: allSubjects.filter((subject) => subject.status === 'APPROVED').length,
      failedSubjects: allSubjects.filter((subject) => subject.status === 'FAILED').length,
      unassignedSubjects: unassigned,
    };
  },
};
