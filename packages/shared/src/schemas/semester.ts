import { z } from 'zod';
import { parseLocalDate } from '../common.js';
import { SEMESTER_STATUS, type SemesterStatus, type SubjectStatus } from '../enums.js';

/**
 * Contrato de semestres e historico academico.
 */

const semesterDateSchema = z
  .union([z.string().min(1, 'Informe a data'), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : parseLocalDate(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }

    return parsed;
  });

/** Campos do semestre SEM defaults - ver a explicacao em `subject.ts`. */
const semesterBaseSchema = z.object({
  name: z
    .string({ error: 'Informe o nome do semestre' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(40, 'O nome pode ter no máximo 40 caracteres'),

  year: z.coerce
    .number({ error: 'Informe o ano' })
    .int('Use um ano válido')
    .min(2000, 'Ano muito antigo')
    .max(2100, 'Ano muito distante'),

  /** Periodo dentro do ano: 1 ou 2. */
  term: z.coerce
    .number({ error: 'Informe o período' })
    .int()
    .min(1, 'O período é 1 ou 2')
    .max(2, 'O período é 1 ou 2'),

  startDate: semesterDateSchema,
  endDate: semesterDateSchema,

  status: z.enum(SEMESTER_STATUS),

  /** Semestre exibido por padrao no dashboard. */
  isCurrent: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === 'true'),
});

export const createSemesterSchema = semesterBaseSchema
  .extend({
    status: z.enum(SEMESTER_STATUS).default('ACTIVE'),
    isCurrent: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'O término precisa ser depois do início',
    path: ['endDate'],
  });

export type CreateSemesterInput = z.output<typeof createSemesterSchema>;
export type SemesterFormValues = z.input<typeof createSemesterSchema>;

/** Edicao: sem defaults, para o PATCH nao sobrescrever o que nao foi enviado. */
export const updateSemesterSchema = semesterBaseSchema.partial();
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;

export interface SemesterListItem {
  id: string;
  name: string;
  year: number;
  term: number;
  status: SemesterStatus;
  isCurrent: boolean;
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
  isCurrent: boolean;
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
