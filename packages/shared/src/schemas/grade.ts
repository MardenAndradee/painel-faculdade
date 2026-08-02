import { z } from 'zod';
import { GRADE_TYPE, type GradeType } from '../enums.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de notas.
 *
 * Uma nota pode existir sozinha (lancamento avulso) ou vinculada a uma prova
 * ja cadastrada - `Grade.examId` e unico, entao a relacao e 1-1.
 */

/** Campos da nota SEM defaults - ver a explicacao em `subject.ts`. */
const gradeBaseSchema = z.object({
  subjectId: z.string({ error: 'Selecione a disciplina' }).min(1, 'Selecione a disciplina'),

  type: z.enum(GRADE_TYPE),

  /** Rotulo livre, util para tipos genericos ("Lista 3", "Prova substitutiva"). */
  label: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),

  value: z.coerce
    .number({ error: 'Informe a nota' })
    .min(0, 'A nota não pode ser negativa')
    .max(1000, 'Valor muito alto'),

  /** Escala da avaliacao. Notas sao normalizadas para 0-10 no calculo. */
  maxValue: z.coerce
    .number()
    .positive('A escala precisa ser maior que zero')
    .max(1000, 'Valor muito alto'),

  weight: z.coerce.number().min(0, 'O peso não pode ser negativo').max(100, 'Peso muito alto'),

  /** Prova correspondente, quando a nota vier de uma avaliacao cadastrada. */
  examId: z.string().min(1).nullable().optional(),

  gradedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((value) => {
      if (!value) return undefined;

      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }),

  notes: z.string().trim().max(1000, 'Máximo de 1000 caracteres').optional().or(z.literal('')),
});

/** Criacao: escala 0-10 e peso 1 por padrao. */
export const createGradeSchema = gradeBaseSchema.extend({
  type: z.enum(GRADE_TYPE).default('OTHER'),
  maxValue: z.coerce
    .number()
    .positive('A escala precisa ser maior que zero')
    .max(1000, 'Valor muito alto')
    .default(10),
  weight: z.coerce
    .number()
    .min(0, 'O peso não pode ser negativo')
    .max(100, 'Peso muito alto')
    .default(1),
});

export type CreateGradeInput = z.output<typeof createGradeSchema>;
export type GradeFormValues = z.input<typeof createGradeSchema>;

/** Edicao: sem defaults. Um PATCH da nota nao pode resetar a escala. */
export const updateGradeSchema = gradeBaseSchema.partial();
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;

export interface GradeListItem {
  id: string;
  type: GradeType;
  label: string | null;
  value: number;
  maxValue: number;
  weight: number;
  /** Nota convertida para a escala 0-10, que e como a media e calculada. */
  normalized: number;
  gradedAt: string;
  notes: string | null;
  subject: SubjectRef;
  /** Prova vinculada, quando houver. */
  exam: { id: string; title: string; date: string } | null;
  createdAt: string;
}

/** Situacao de uma disciplina em relacao a aprovacao. */
export type SubjectGradeStatus =
  'SEM_NOTAS' | 'APROVADO' | 'REPROVADO' | 'EM_RECUPERACAO' | 'EM_ANDAMENTO';

export const SUBJECT_GRADE_STATUS_LABELS: Record<SubjectGradeStatus, string> = {
  SEM_NOTAS: 'Sem notas',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  EM_RECUPERACAO: 'Atenção',
  EM_ANDAMENTO: 'Em andamento',
};

/** Boletim de uma disciplina: notas lancadas e projecao de aprovacao. */
export interface SubjectGradeSummary {
  subject: SubjectRef & { passingGrade: number };
  grades: GradeListItem[];
  /** Media ponderada das notas lancadas, na escala 0-10. */
  average: number | null;
  /** Soma dos pesos ja avaliados. */
  usedWeight: number;
  /**
   * Peso ainda por avaliar, deduzido das provas cadastradas sem nota.
   * `null` quando nao ha como saber o que falta.
   */
  remainingWeight: number | null;
  /**
   * Nota necessaria no restante para atingir a media de aprovacao.
   *
   * `null` quando nao ha peso restante conhecido; `<= 0` quando a aprovacao
   * ja esta garantida; acima da escala quando ja e inalcancavel.
   */
  requiredGrade: number | null;
  status: SubjectGradeStatus;
  /** Provas cadastradas que ainda nao tem nota lancada. */
  pendingExams: Array<{ id: string; title: string; date: string; weight: number }>;
}

/** Visao geral do desempenho, usada na tela de Notas. */
export interface GradesOverview {
  subjects: SubjectGradeSummary[];
  /** Media geral: media simples das medias por disciplina. */
  overallAverage: number | null;
  totalGrades: number;
  subjectsAtRisk: number;
}
