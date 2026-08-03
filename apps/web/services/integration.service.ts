import type {
  AutoSyncResult,
  CalendarSyncReport,
  IntegrationStatus,
  SyncReport,
} from '@painel/shared';
import { httpClient } from './http-client';

export const integrationService = {
  status(): Promise<IntegrationStatus> {
    return httpClient.get<IntegrationStatus>('/integrations/status');
  },

  /**
   * Obtem a URL de autorizacao do Classroom.
   *
   * A API devolve a URL em vez de redirecionar: a chamada parte de um `fetch`
   * autenticado, e um redirect ali nao levaria o usuario a lugar nenhum.
   */
  connectClassroom(): Promise<{ url: string }> {
    return httpClient.get<{ url: string }>('/integrations/classroom/connect');
  },

  /** Disparada ao abrir o app; o servidor decide se realmente sincroniza. */
  autoSyncClassroom(): Promise<AutoSyncResult> {
    return httpClient.post<AutoSyncResult>('/integrations/classroom/auto-sync');
  },

  syncClassroom(): Promise<SyncReport> {
    return httpClient.post<SyncReport>('/integrations/classroom/sync');
  },

  disconnectClassroom(): Promise<void> {
    return httpClient.delete<void>('/integrations/classroom');
  },

  connectCalendar(): Promise<{ url: string }> {
    return httpClient.get<{ url: string }>('/integrations/calendar/connect');
  },

  syncCalendar(): Promise<CalendarSyncReport> {
    return httpClient.post<CalendarSyncReport>('/integrations/calendar/sync');
  },

  disconnectCalendar(): Promise<{ removedEvents: number }> {
    return httpClient.delete<{ removedEvents: number }>('/integrations/calendar');
  },
};
