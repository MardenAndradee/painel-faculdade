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

export const GRADE_TYPE = [
  'P1',
  'P2',
  'P3',
  'ASSIGNMENT',
  'SEMINAR',
  'PROJECT',
  'PARTICIPATION',
  'OTHER',
] as const;
export type GradeType = (typeof GRADE_TYPE)[number];

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
  'EXAM_UPCOMING',
  'GRADE_POSTED',
  'STUDY_SESSION',
  'SYNC_COMPLETED',
  'SYNC_FAILED',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const THEME_PREFERENCE = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type ThemePreference = (typeof THEME_PREFERENCE)[number];

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

export const GRADE_TYPE_LABELS: Record<GradeType, string> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  ASSIGNMENT: 'Trabalho',
  SEMINAR: 'Seminario',
  PROJECT: 'Projeto',
  PARTICIPATION: 'Participacao',
  OTHER: 'Outro',
};
