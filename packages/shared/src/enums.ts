/**
 * Espelho dos enums definidos no schema Prisma.
 *
 * O backend importa daqui em vez de `@prisma/client` para que o pacote shared
 * permaneca livre de dependencia do Prisma e possa ser consumido pelo browser.
 * Qualquer alteracao aqui exige a migration correspondente no schema.
 */

export const SEMESTER_STATUS = ['PLANNED', 'ACTIVE', 'FINISHED'] as const;
export type SemesterStatus = (typeof SEMESTER_STATUS)[number];

export const SUBJECT_STATUS = ['IN_PROGRESS', 'APPROVED', 'FAILED', 'WITHDRAWN'] as const;
export type SubjectStatus = (typeof SUBJECT_STATUS)[number];

export const ASSIGNMENT_SOURCE = ['MANUAL', 'GOOGLE_CLASSROOM'] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCE)[number];

export const ASSIGNMENT_STATUS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

export const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITY)[number];

export const CALENDAR_EVENT_SOURCE = ['MANUAL', 'GOOGLE_CALENDAR'] as const;
export type CalendarEventSource = (typeof CALENDAR_EVENT_SOURCE)[number];

export const ATTACHMENT_TYPE = [
  'PDF',
  'IMAGE',
  'ZIP',
  'SLIDE',
  'LINK',
  'DOCUMENT',
  'OTHER',
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPE)[number];

export const ATTACHMENT_SOURCE = ['UPLOAD', 'LINK', 'GOOGLE_CLASSROOM', 'GOOGLE_DRIVE'] as const;
export type AttachmentSource = (typeof ATTACHMENT_SOURCE)[number];

export const STUDY_SESSION_STATUS = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as const;
export type StudySessionStatus = (typeof STUDY_SESSION_STATUS)[number];

export const NOTIFICATION_TYPE = [
  'ASSIGNMENT_DUE',
  'ASSIGNMENT_OVERDUE',
  /** Atividade trazida pela sincronizacao do Classroom (Etapa 19). */
  'ASSIGNMENT_CREATED',
  'EXAM_UPCOMING',
  'GRADE_POSTED',
  'STUDY_SESSION',
  'SYNC_COMPLETED',
  'SYNC_FAILED',
  'SYSTEM',
  /** Aviso publicado no mural de uma turma (Etapa 22). */
  'CLASS_ANNOUNCEMENT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

/**
 * Urgencia da notificacao (Etapa 19), separada do tipo: a mesma atividade vira
 * ATTENTION quando vence amanha e URGENT quando vence hoje, sem trocar de
 * tipo.
 */
export const NOTIFICATION_PRIORITY = ['URGENT', 'ATTENTION', 'INFO', 'DONE'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITY)[number];

export const THEME_PREFERENCE = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type ThemePreference = (typeof THEME_PREFERENCE)[number];

/// Papel do membro numa turma (Etapa 20).
export const CLASS_ROLE = ['OWNER', 'MEMBER'] as const;
export type ClassRole = (typeof CLASS_ROLE)[number];

export const CLASS_MEMBER_STATUS = ['ACTIVE', 'LEFT'] as const;
export type ClassMemberStatus = (typeof CLASS_MEMBER_STATUS)[number];

/// O que um `ClassPost` publica (Etapa 21): cada um vira uma cópia pessoal por
/// membro - Assignment, Exam ou CalendarEvent.
export const CLASS_POST_KIND = ['ASSIGNMENT', 'EXAM', 'EVENT'] as const;
export type ClassPostKind = (typeof CLASS_POST_KIND)[number];

/** Rotulos em portugues para exibicao na interface. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
};

export const SUBJECT_STATUS_LABELS: Record<SubjectStatus, string> = {
  IN_PROGRESS: 'Cursando',
  APPROVED: 'Aprovado',
  FAILED: 'Reprovado',
  WITHDRAWN: 'Trancado',
};
