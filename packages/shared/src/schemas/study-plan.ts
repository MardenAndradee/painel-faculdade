import { z } from 'zod';
import { STUDY_SESSION_STATUS, type StudySessionStatus } from '../enums.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato do cronograma de estudos.
 *
 * O cronograma nao e um calendario paralelo: ele responde "o que eu estudo
 * hoje" a partir do que ja existe no sistema - provas proximas e atividades
 * pendentes - encaixado nas janelas em que o aluno declarou estar livre.
 */

export const STUDY_SESSION_STATUS_LABELS: Record<StudySessionStatus, string> = {
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  SKIPPED: 'Pulado',
};

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const WEEKDAY_SHORT_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

/** Minutos desde a meia-noite, em passos de 15. */
const minuteOfDaySchema = z.coerce
  .number()
  .int('Use um horário válido')
  .min(0, 'Horário inválido')
  .max(24 * 60, 'Horário inválido');

const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.coerce
      .number()
      .int()
      .min(0, 'Dia da semana inválido')
      .max(6, 'Dia da semana inválido'),
    startMinute: minuteOfDaySchema,
    endMinute: minuteOfDaySchema,
  })
  .refine((window) => window.endMinute > window.startMinute, {
    error: 'O fim precisa ser depois do início',
    path: ['endMinute'],
  });

export type AvailabilityWindowInput = z.infer<typeof availabilityWindowSchema>;

/**
 * A disponibilidade e salva inteira, nao janela a janela.
 *
 * O usuario edita uma grade semanal e clica em salvar uma vez; enviar o
 * conjunto completo evita um vaivem de POST/DELETE por janela e torna
 * impossivel a tela ficar em estado parcial se uma das chamadas falhar.
 */
export const saveAvailabilitySchema = z.object({
  windows: z
    .array(availabilityWindowSchema)
    .max(50, 'Muitas janelas de disponibilidade')
    .default([]),
});

export type SaveAvailabilityInput = z.infer<typeof saveAvailabilitySchema>;

export interface AvailabilityWindow {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

// ---------------------------------------------------------------------------
// Blocos de estudo
// ---------------------------------------------------------------------------

/** O input `datetime-local` entrega "2026-08-15T19:00" em horario local. */
const dateTimeSchema = z
  .union([z.string().min(1, 'Informe a data e a hora'), z.date()], {
    error: 'Informe a data e a hora',
  })
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }

    return parsed;
  });

/** Campos do bloco SEM defaults - ver a explicacao em `subject.ts`. */
const studySessionBaseSchema = z.object({
  title: z
    .string({ error: 'Informe o título' })
    .trim()
    .min(2, 'O título precisa de ao menos 2 caracteres')
    .max(200, 'O título pode ter no máximo 200 caracteres'),

  scheduledStart: dateTimeSchema,
  scheduledEnd: dateTimeSchema,

  subjectId: z.string().min(1).optional().or(z.literal('')),
  assignmentId: z.string().min(1).optional().or(z.literal('')),
  examId: z.string().min(1).optional().or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(1000, 'As observações podem ter no máximo 1000 caracteres')
    .optional()
    .or(z.literal('')),
});

export const createStudySessionSchema = studySessionBaseSchema.refine(
  (session) => session.scheduledEnd > session.scheduledStart,
  { error: 'O fim precisa ser depois do início', path: ['scheduledEnd'] },
);

export type CreateStudySessionInput = z.output<typeof createStudySessionSchema>;
export type StudySessionFormValues = z.input<typeof studySessionBaseSchema>;

/** Edicao sem defaults: um PATCH de nota nao pode mexer no horario. */
export const updateStudySessionSchema = studySessionBaseSchema.partial();
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

/** Conclusao de um bloco: o que foi REALMENTE estudado. */
export const completeStudySessionSchema = z.object({
  /** Nulo usa a duracao planejada; informado, registra o tempo real. */
  actualMinutes: z.coerce
    .number()
    .int('Use um número inteiro')
    .min(0, 'Não pode ser negativo')
    .max(24 * 60, 'Duração muito longa')
    .optional(),

  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type CompleteStudySessionInput = z.infer<typeof completeStudySessionSchema>;

export const studyPlanRangeSchema = z.object({
  from: z.string().min(1, 'Informe a data inicial'),
  to: z.string().min(1, 'Informe a data final'),
});

export type StudyPlanRangeQuery = z.infer<typeof studyPlanRangeSchema>;

// ---------------------------------------------------------------------------
// Geracao
// ---------------------------------------------------------------------------

export const generatePlanSchema = z.object({
  /** Quantos dias a frente planejar. Uma semana e o horizonte util. */
  days: z.coerce.number().int().min(1).max(28).default(7),

  /** Duracao de cada bloco. Blocos longos demais nao sobrevivem a atencao. */
  blockMinutes: z.coerce.number().int().min(15).max(240).default(50),

  /** Intervalo entre blocos consecutivos. */
  breakMinutes: z.coerce.number().int().min(0).max(60).default(10),

  /** Teto diario, para o gerador nao lotar um sabado inteiro. */
  maxBlocksPerDay: z.coerce.number().int().min(1).max(12).default(4),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

/** O que originou um bloco automatico. */
export const STUDY_TARGET_KINDS = ['EXAM', 'ASSIGNMENT', 'SUBJECT'] as const;
export type StudyTargetKind = (typeof STUDY_TARGET_KINDS)[number];

export interface StudySessionItem {
  id: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** Duracao planejada em minutos, derivada das duas datas. */
  plannedMinutes: number;
  actualMinutes: number | null;
  status: StudySessionStatus;
  notes: string | null;
  autoGenerated: boolean;
  subject: SubjectRef | null;
  assignment: { id: string; title: string } | null;
  exam: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Resultado da geracao, para a tela explicar o que aconteceu. */
export interface GeneratePlanResult {
  created: number;
  /** Blocos automaticos futuros que foram substituidos. */
  replaced: number;
  /** Blocos manuais que a geracao respeitou. */
  preserved: number;
  /** Itens pendentes que nao couberam nas janelas disponiveis. */
  unscheduled: { kind: StudyTargetKind; title: string; reason: string }[];
  sessions: StudySessionItem[];
}

export interface StudyPlanSummary {
  /** Blocos planejados de hoje em diante. */
  plannedSessions: number;
  /** Minutos planejados para os proximos sete dias. */
  plannedMinutesThisWeek: number;
  /** Minutos efetivamente estudados nos ultimos sete dias. */
  studiedMinutesThisWeek: number;
  completedSessions: number;
  skippedSessions: number;
  /** Concluidos sobre (concluidos + pulados), em porcentagem. Nulo sem dados. */
  adherenceRate: number | null;
  /** Minutos semanais que a disponibilidade declarada oferece. */
  availableMinutesPerWeek: number;
}

export { STUDY_SESSION_STATUS };
