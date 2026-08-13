import { z } from 'zod';
import { PRIORITY, type ClassPostKind, type Priority } from '../enums.js';
import { parseLocalDate } from '../common.js';

/**
 * Contrato de publicações de turma (Etapa 21).
 *
 * Uma turma publica atividade, prova ou evento; o *fan-out* cria uma cópia
 * pessoal para cada membro. `kind` discrimina o schema porque os três tipos
 * exigem campos genuinamente diferentes - uma prova sem data não faz
 * sentido, um evento sem data também não, mas uma atividade sim.
 */

const requiredDateSchema = z
  .union([z.string().min(1, 'Informe a data'), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : parseLocalDate(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }

    return parsed;
  });

const optionalDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return value;

    const parsed = parseLocalDate(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

const titleSchema = z
  .string({ error: 'Informe o título' })
  .trim()
  .min(2, 'O título precisa de ao menos 2 caracteres')
  .max(200, 'O título pode ter no máximo 200 caracteres');

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Máximo de 2000 caracteres')
  .optional()
  .or(z.literal(''));

/** Ausente = publicação avulsa, sem disciplina. */
const optionalClassSubjectIdSchema = z.string().min(1).nullable().optional();

const assignmentPostSchema = z.object({
  kind: z.literal('ASSIGNMENT'),
  title: titleSchema,
  description: descriptionSchema,
  classSubjectId: optionalClassSubjectIdSchema,
  dueDate: optionalDateSchema,
  priority: z.enum(PRIORITY).default('MEDIUM'),
  maxPoints: z.coerce
    .number()
    .min(0, 'Não pode ser negativo')
    .max(1000, 'Valor muito alto')
    .optional(),
});

const examPostSchema = z.object({
  kind: z.literal('EXAM'),
  title: titleSchema,
  description: descriptionSchema,
  /** Obrigatória: `Exam.subjectId` não é anulável, a cópia sempre precisa de uma disciplina. */
  classSubjectId: z.string({ error: 'Selecione a disciplina' }).min(1, 'Selecione a disciplina'),
  date: requiredDateSchema,
  durationMinutes: z.coerce
    .number()
    .int('Use um número inteiro')
    .min(0, 'Não pode ser negativo')
    .max(600, 'Duração muito longa')
    .optional(),
  room: z.string().trim().max(60, 'Máximo de 60 caracteres').optional().or(z.literal('')),
});

const eventPostSchema = z.object({
  kind: z.literal('EVENT'),
  title: titleSchema,
  description: descriptionSchema,
  classSubjectId: optionalClassSubjectIdSchema,
  startsAt: requiredDateSchema,
  endsAt: requiredDateSchema,
  allDay: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export const createClassPostSchema = z
  .discriminatedUnion('kind', [assignmentPostSchema, examPostSchema, eventPostSchema])
  .refine((data) => data.kind !== 'EVENT' || data.endsAt >= data.startsAt, {
    message: 'O término precisa ser depois do início',
    path: ['endsAt'],
  });

export type CreateClassPostInput = z.output<typeof createClassPostSchema>;
export type ClassPostFormValues = z.input<typeof createClassPostSchema>;

/** Edição: mesmos três formatos, `kind` nunca muda depois de publicado. */
export const updateClassPostSchema = z.discriminatedUnion('kind', [
  assignmentPostSchema.partial().extend({ kind: z.literal('ASSIGNMENT') }),
  examPostSchema.partial().extend({ kind: z.literal('EXAM') }),
  eventPostSchema.partial().extend({ kind: z.literal('EVENT') }),
]);

export type UpdateClassPostInput = z.infer<typeof updateClassPostSchema>;

// --- Leitura -------------------------------------------------------------------

export interface ClassPostListItem {
  id: string;
  kind: ClassPostKind;
  title: string;
  description: string | null;
  date: string | null;
  durationMinutes: number | null;
  room: string | null;
  dueDate: string | null;
  priority: Priority | null;
  maxPoints: number | null;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean | null;
  classSubject: { id: string; name: string; color: string } | null;
  createdBy: { id: string; name: string };
  /** Quantos membros têm cópia (deveria ser igual ao nº de membros ativos). */
  copyCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Referência mínima da turma, exibida como selo nas cópias pessoais. */
export interface ClassPostBadge {
  classId: string;
  className: string;
}

export const CLASS_POST_KIND_LABELS: Record<ClassPostKind, string> = {
  ASSIGNMENT: 'Atividade',
  EXAM: 'Prova',
  EVENT: 'Evento',
};
