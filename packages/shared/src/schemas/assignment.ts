import { z } from 'zod';
import {
  ASSIGNMENT_STATUS,
  PRIORITY,
  type AssignmentSource,
  type AssignmentStatus,
  type Priority,
} from '../enums.js';
import { booleanQueryParam, paginationQuerySchema, parseLocalDate } from '../common.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de atividades.
 *
 * Vale tanto para atividades criadas a mao quanto para as importadas do
 * Google Classroom: sao a mesma entidade, distinguidas por `source`.
 */

/**
 * Recortes prontos da listagem.
 *
 * "Atrasadas" e "hoje" combinam status e data - expor isso como filtros soltos
 * obrigaria cada tela a remontar a regra, e a errar. O servidor traduz.
 */
export const ASSIGNMENT_VIEWS = [
  'todas',
  'pendentes',
  'concluidas',
  'atrasadas',
  'hoje',
  'semana',
] as const;

export type AssignmentView = (typeof ASSIGNMENT_VIEWS)[number];

export const ASSIGNMENT_VIEW_LABELS: Record<AssignmentView, string> = {
  todas: 'Todas',
  pendentes: 'Pendentes',
  concluidas: 'Concluídas',
  atrasadas: 'Atrasadas',
  hoje: 'Hoje',
  semana: 'Esta semana',
};

export const ASSIGNMENT_SORT_FIELDS = [
  'dueDate',
  'priority',
  'subject',
  'createdAt',
  'title',
] as const;
export type AssignmentSortField = (typeof ASSIGNMENT_SORT_FIELDS)[number];

export const ASSIGNMENT_SORT_LABELS: Record<AssignmentSortField, string> = {
  dueDate: 'Prazo',
  priority: 'Prioridade',
  subject: 'Disciplina',
  createdAt: 'Criação',
  title: 'Título',
};

/**
 * Prazo enviado pelo formulario.
 *
 * O input `datetime-local` produz "2026-08-15T23:59" (sem fuso). Interpretamos
 * como horario local do usuario, que e o que ele digitou.
 */
const dueDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return value;

    const parsed = parseLocalDate(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

/** Campos da atividade SEM defaults - ver a explicacao em `subject.ts`. */
const assignmentBaseSchema = z.object({
  title: z
    .string({ error: 'Informe o título' })
    .trim()
    .min(2, 'O título precisa de ao menos 2 caracteres')
    .max(200, 'O título pode ter no máximo 200 caracteres'),

  description: z
    .string()
    .trim()
    .max(2000, 'A descrição pode ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(2000, 'As observações podem ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),

  subjectId: z.string().min(1).nullable().optional(),

  dueDate: dueDateSchema,

  priority: z.enum(PRIORITY),
  status: z.enum(ASSIGNMENT_STATUS),

  maxPoints: z.coerce
    .number()
    .min(0, 'Não pode ser negativo')
    .max(1000, 'Valor muito alto')
    .optional(),
});

/** Criacao: aplica os valores padrao. */
export const createAssignmentSchema = assignmentBaseSchema.extend({
  priority: z.enum(PRIORITY).default('MEDIUM'),
  status: z.enum(ASSIGNMENT_STATUS).default('PENDING'),
});

export type CreateAssignmentInput = z.output<typeof createAssignmentSchema>;
/** Tipo manipulado pelo formulario: defaults ainda opcionais. */
export type AssignmentFormValues = z.input<typeof createAssignmentSchema>;

/** Edicao: sem defaults, para nao sobrescrever o que nao foi enviado. */
export const updateAssignmentSchema = assignmentBaseSchema.partial();
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const assignmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  view: z.enum(ASSIGNMENT_VIEWS).default('todas'),
  subjectId: z.string().min(1).optional(),
  priority: z.enum(PRIORITY).optional(),
  status: z.enum(ASSIGNMENT_STATUS).optional(),
  /** Inclui atividades sem prazo definido nos recortes por data. */
  includeUndated: booleanQueryParam(false),
  sortBy: z.enum(ASSIGNMENT_SORT_FIELDS).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;

/** Atividade como aparece nas listagens. */
export interface AssignmentListItem {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  dueDate: string | null;
  priority: Priority;
  status: AssignmentStatus;
  source: AssignmentSource;
  completedAt: string | null;
  maxPoints: number | null;
  classroomLink: string | null;
  subject: SubjectRef | null;
  /** Dias ate o prazo: negativo se atrasada, 0 se vence hoje, null sem prazo. */
  daysUntilDue: number | null;
  /** Verdadeiro apenas para atividades em aberto com prazo vencido. */
  isOverdue: boolean;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Contagem por recorte, exibida nas abas de filtro. */
export type AssignmentCounts = Record<AssignmentView, number>;
