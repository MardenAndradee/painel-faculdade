import { z } from 'zod';
import { booleanQueryParam } from '../common.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato do calendario.
 *
 * A agenda agrega quatro fontes num formato unico. Provas e atividades NAO sao
 * copiadas para a tabela de eventos - sao agregadas em tempo de consulta, entao
 * editar uma prova reflete no calendario na hora.
 */

export const CALENDAR_ITEM_KINDS = ['EVENT', 'EXAM', 'ASSIGNMENT'] as const;
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

export const CALENDAR_KIND_LABELS: Record<CalendarItemKind, string> = {
  EVENT: 'Evento',
  EXAM: 'Prova',
  ASSIGNMENT: 'Entrega',
};

export const CALENDAR_VIEWS = ['dia', 'semana', 'mes'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
};

/** Item da agenda, qualquer que seja a origem. */
export interface CalendarItem {
  /** Unico dentro da agenda: prefixado por tipo, pois ids se repetem entre tabelas. */
  key: string;
  /** Id do registro de origem, usado para abrir a edicao. */
  id: string;
  kind: CalendarItemKind;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  subject: SubjectRef | null;
  /** Somente para EVENT: distingue evento proprio de importado do Google. */
  source: 'MANUAL' | 'GOOGLE_CALENDAR' | null;
  /** Somente para ASSIGNMENT: permite riscar entregas ja concluidas. */
  isCompleted: boolean;
}

/**
 * O intervalo e calculado no fuso do navegador e enviado como ISO absoluto:
 * "semana de 3 a 9 de agosto" depende de onde o usuario esta.
 */
export const calendarRangeSchema = z.object({
  from: z.string().min(1, 'Informe o início do intervalo'),
  to: z.string().min(1, 'Informe o fim do intervalo'),
  /** Permite ocultar entregas já concluídas da agenda. */
  includeCompleted: booleanQueryParam(true),
});

export type CalendarRangeQuery = z.infer<typeof calendarRangeSchema>;

// --- Eventos manuais ----------------------------------------------------------

const eventDateSchema = z
  .union([z.string().min(1, 'Informe a data'), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }

    return parsed;
  });

export const createCalendarEventSchema = z
  .object({
    title: z
      .string({ error: 'Informe o título' })
      .trim()
      .min(2, 'O título precisa de ao menos 2 caracteres')
      .max(200, 'O título pode ter no máximo 200 caracteres'),

    description: z
      .string()
      .trim()
      .max(2000, 'Máximo de 2000 caracteres')
      .optional()
      .or(z.literal('')),

    location: z.string().trim().max(200, 'Máximo de 200 caracteres').optional().or(z.literal('')),

    startsAt: eventDateSchema,
    endsAt: eventDateSchema,

    allDay: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true'),

    subjectId: z.string().min(1).nullable().optional(),

    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB')
      .nullable()
      .optional()
      .or(z.literal('')),
  })
  // Evento que termina antes de comecar e erro de digitacao, nao dado valido.
  .refine((data) => data.endsAt >= data.startsAt, {
    message: 'O término precisa ser depois do início',
    path: ['endsAt'],
  });

export type CreateCalendarEventInput = z.output<typeof createCalendarEventSchema>;
export type CalendarEventFormValues = z.input<typeof createCalendarEventSchema>;

/**
 * Edicao parcial.
 *
 * O `.refine` do schema de criacao compara duas datas e nao sobrevive ao
 * `.partial()`, entao a validacao cruzada aqui roda apenas quando ambas as
 * datas sao enviadas - o service revalida contra os valores atuais.
 */
export const updateCalendarEventSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  startsAt: eventDateSchema.optional(),
  endsAt: eventDateSchema.optional(),
  allDay: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === true || value === 'true';
    }),
  subjectId: z.string().min(1).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB')
    .nullable()
    .optional()
    .or(z.literal('')),
});

export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

export interface CalendarEventDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  source: 'MANUAL' | 'GOOGLE_CALENDAR';
  subject: SubjectRef | null;
  createdAt: string;
  updatedAt: string;
}
