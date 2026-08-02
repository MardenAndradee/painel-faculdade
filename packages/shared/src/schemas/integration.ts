/**
 * Contrato das integracoes com o Google.
 */

/** Resultado de uma sincronizacao, exibido ao usuario ao final. */
export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  subjects: { created: number; updated: number };
  teachers: { created: number; updated: number };
  assignments: { created: number; updated: number; skipped: number };
  attachments: { created: number };
  /** Turmas que falharam individualmente, sem abortar a sincronizacao inteira. */
  warnings: string[];
}

export interface IntegrationStatus {
  /** Conta Google vinculada (sempre verdadeiro apos o login). */
  googleConnected: boolean;
  /** Escopos do Classroom concedidos. */
  classroomConnected: boolean;
  calendarConnected: boolean;
  classroomSyncedAt: string | null;
  calendarSyncedAt: string | null;
  /** Quantos registros vieram do Classroom. */
  importedSubjects: number;
  importedAssignments: number;
}

/** Resultado da sincronizacao do Google Calendar. */
export interface CalendarSyncReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  created: number;
  updated: number;
  /** Eventos que sumiram do Google e foram removidos daqui. */
  removed: number;
  /** Cancelados ou sem data utilizavel. */
  skipped: number;
  windowFrom: string;
  windowTo: string;
}
