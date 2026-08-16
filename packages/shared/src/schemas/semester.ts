import { z } from 'zod';
import type { SemesterStatus, SubjectStatus } from '../enums.js';

/**
 * Contrato de semestres e historico academico.
 *
 * Nao ha mais criacao manual (Etapa 31): o Semester nasce sozinho, calculado
 * pela data de hoje (ver `semester-period.ts`). So o nome pode ser editado
 * depois - ano/periodo/datas sao a identidade do registro.
 */

export const updateSemesterSchema = z.object({
  name: z
    .string({ error: 'Informe o nome do semestre' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(40, 'O nome pode ter no máximo 40 caracteres'),
});

export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;

export interface SemesterListItem {
  id: string;
  name: string;
  year: number;
  term: number;
  status: SemesterStatus;
  startDate: string;
  endDate: string;
  subjectCount: number;
  createdAt: string;
}

// --- Historico -------------------------------------------------------------------

/** Disciplina como aparece no historico, com resultado consolidado. */
export interface HistorySubject {
  id: string;
  name: string;
  code: string | null;
  color: string;
  credits: number | null;
  passingGrade: number;
  status: SubjectStatus;
  /**
   * Media final.
   *
   * Em semestre encerrado vem de `finalGrade` (congelado no encerramento);
   * em semestre em andamento e calculada a partir das notas lancadas.
   */
  average: number | null;
  /** Verdadeiro quando a media veio do valor consolidado. */
  isConsolidated: boolean;
  gradeCount: number;
  teacherName: string | null;
}

export interface HistorySemester {
  id: string;
  name: string;
  year: number;
  term: number;
  status: SemesterStatus;
  startDate: string;
  endDate: string;
  subjects: HistorySubject[];
  /** Media simples das medias das disciplinas com nota. */
  average: number | null;
  approvedCount: number;
  failedCount: number;
  inProgressCount: number;
  totalCredits: number;
  /** Creditos efetivamente concluidos (apenas aprovadas). */
  earnedCredits: number;
}

/** Historico completo, agrupado por semestre. */
export interface AcademicHistory {
  semesters: HistorySemester[];
  /**
   * Coeficiente de rendimento acumulado, ponderado por creditos.
   *
   * Diferente da media geral do dashboard (media simples do semestre atual):
   * aqui uma disciplina de 6 creditos pesa o triplo de uma de 2. E o numero
   * que a universidade costuma usar.
   */
  overallCr: number | null;
  totalCredits: number;
  earnedCredits: number;
  approvedSubjects: number;
  failedSubjects: number;
  /** Disciplinas sem semestre atribuido, exibidas a parte. */
  unassignedSubjects: HistorySubject[];
}

/** Previa do que o encerramento vai consolidar. */
export interface CloseSemesterPreview {
  semester: { id: string; name: string };
  subjects: Array<{
    id: string;
    name: string;
    average: number | null;
    passingGrade: number;
    /** Situacao que sera gravada. */
    resultingStatus: SubjectStatus;
  }>;
  /** Disciplinas sem nenhuma nota: ficam sem media final. */
  withoutGrades: number;
}
