import { z } from 'zod';
import { paginationQuerySchema, parseLocalDate } from '../common.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de provas.
 *
 * Diferente de atividades, prova exige disciplina: `Exam.subjectId` e
 * obrigatorio no schema. Uma prova sem materia nao existe, enquanto uma
 * tarefa pessoal pode existir solta.
 */

/**
 * Recortes da listagem.
 *
 * Prova nao tem status "pendente/concluida" - ou ja aconteceu, ou nao. O
 * recorte e puramente temporal.
 */
export const EXAM_VIEWS = ['proximas', 'realizadas', 'todas'] as const;
export type ExamView = (typeof EXAM_VIEWS)[number];

export const EXAM_VIEW_LABELS: Record<ExamView, string> = {
  proximas: 'Próximas',
  realizadas: 'Realizadas',
  todas: 'Todas',
};

export const EXAM_SORT_FIELDS = ['date', 'subject', 'weight', 'title'] as const;
export type ExamSortField = (typeof EXAM_SORT_FIELDS)[number];

export const EXAM_SORT_LABELS: Record<ExamSortField, string> = {
  date: 'Data',
  subject: 'Disciplina',
  weight: 'Peso',
  title: 'Título',
};

/** O input `datetime-local` entrega "2026-08-15T19:00" em horario local. */
const examDateSchema = z
  // A mensagem precisa estar no `.min(1)` tambem: o formulario envia string
  // vazia quando o campo nao foi preenchido, e nao `undefined`.
  .union([z.string().min(1, 'Informe a data da prova'), z.date()], {
    error: 'Informe a data da prova',
  })
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : parseLocalDate(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }

    return parsed;
  });

/** Campos da prova SEM defaults - ver a explicacao em `subject.ts`. */
const examBaseSchema = z.object({
  /**
   * Opcional: o formulario nao coleta mais titulo (o card em destaque usa o
   * nome da disciplina). Quando ausente, o service preenche um padrao.
   */
  title: z
    .string()
    .trim()
    .max(200, 'O título pode ter no máximo 200 caracteres')
    .optional()
    .or(z.literal('')),

  /** Obrigatoria: toda prova pertence a uma disciplina. */
  subjectId: z.string({ error: 'Selecione a disciplina' }).min(1, 'Selecione a disciplina'),

  date: examDateSchema,

  content: z
    .string()
    .trim()
    .max(2000, 'O conteúdo pode ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(2000, 'As observações podem ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),

  room: z.string().trim().max(60, 'Máximo de 60 caracteres').optional().or(z.literal('')),

  durationMinutes: z.coerce
    .number()
    .int('Use um número inteiro')
    .min(0, 'Não pode ser negativo')
    .max(600, 'Duração muito longa')
    .optional(),

  /**
   * A que componente de avaliacao esta prova se refere (N1, N2...), quando a
   * disciplina tem uma configuracao de notas (Etapa 17).
   */
  gradeComponentId: z.string().min(1).nullable().optional(),

  /**
   * Lancamento rapido da nota, direto no formulario da prova. `null`/vazio
   * remove a nota ja lancada; um numero cria ou atualiza a `Grade` vinculada
   * a este componente. Exige `gradeComponentId` preenchido.
   *
   * O preprocess e necessario porque o input HTML vazio chega como `''`, e
   * `z.coerce.number()` converteria isso para `0` (uma nota real de zero) em
   * vez de "ainda sem nota" - exatamente o bug de provas futuras contarem
   * como zero na media.
   */
  gradeValue: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce
      .number()
      .min(0, 'A nota não pode ser negativa')
      .max(1000, 'Valor muito alto')
      .nullable()
      .optional(),
  ),
});

/**
 * Criacao.
 *
 * Nao ha campo de peso: o peso de uma prova e o do componente escolhido
 * (Etapa 18). Ver `ExamListItem.weight`.
 */
export const createExamSchema = examBaseSchema;

export type CreateExamInput = z.output<typeof createExamSchema>;
export type ExamFormValues = z.input<typeof createExamSchema>;

/** Edicao: sem defaults - ver a explicacao do padrao `xBaseSchema` em `subject.ts`. */
export const updateExamSchema = examBaseSchema.partial();
export type UpdateExamInput = z.infer<typeof updateExamSchema>;

export const examQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  view: z.enum(EXAM_VIEWS).default('proximas'),
  subjectId: z.string().min(1).optional(),
  sortBy: z.enum(EXAM_SORT_FIELDS).default('date'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ExamQuery = z.infer<typeof examQuerySchema>;

/** Nota lancada para a prova, quando existir. */
export interface ExamGradeRef {
  id: string;
  value: number;
  maxValue: number;
}

export interface ExamListItem {
  id: string;
  title: string;
  content: string | null;
  notes: string | null;
  room: string | null;
  date: string;
  /**
   * Peso da prova - sempre o do componente escolhido, derivado na leitura.
   *
   * `null` quando a prova nao aponta para nenhum componente: uma prova fora da
   * configuracao de notas nao tem peso, e exibir "1" sugeriria que ela entra
   * na media.
   */
  weight: number | null;
  durationMinutes: number | null;
  subject: SubjectRef;
  /** Negativo se ja aconteceu, 0 se e hoje. */
  daysUntilExam: number;
  /** Verdadeiro quando a data ja passou. */
  isPast: boolean;
  /** Componente de avaliacao que esta prova representa, quando escolhido. */
  gradeComponent: { id: string; name: string; weight: number } | null;
  /** Nota lancada, quando houver. Alimenta o historico da disciplina. */
  grade: ExamGradeRef | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ExamCounts = Record<ExamView, number>;
