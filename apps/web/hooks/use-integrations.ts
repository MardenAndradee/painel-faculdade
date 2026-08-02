'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CalendarSyncReport, SyncReport } from '@painel/shared';
import { integrationService } from '@/services/integration.service';
import { subjectKeys } from './use-subjects';
import { assignmentKeys } from './use-assignments';
import { dashboardKeys } from './use-dashboard';
import { calendarKeys } from './use-calendar';
import { ApiError } from '@/services/http-client';

/** Hooks das integracoes com o Google. */

export const integrationKeys = {
  status: ['integrations', 'status'] as const,
};

export function useIntegrationStatus() {
  return useQuery({
    queryKey: integrationKeys.status,
    queryFn: () => integrationService.status(),
  });
}

/** Resumo legível do que a sincronização trouxe. */
export function summarizeReport(report: SyncReport): string {
  const parts: string[] = [];

  const total = (group: { created: number; updated: number }) => group.created + group.updated;

  if (total(report.subjects) > 0) {
    parts.push(`${total(report.subjects)} disciplinas`);
  }
  if (report.assignments.created > 0) {
    parts.push(`${report.assignments.created} atividades novas`);
  }
  if (report.assignments.updated > 0) {
    parts.push(`${report.assignments.updated} atualizadas`);
  }
  if (report.attachments.created > 0) {
    parts.push(`${report.attachments.created} anexos`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Nada novo para importar';
}

export function useSyncClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationService.syncClassroom(),

    onSuccess: async (report) => {
      // A sincronização mexe em disciplinas, atividades, dashboard e agenda.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: integrationKeys.status }),
        queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
        queryClient.invalidateQueries({ queryKey: assignmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
        queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
      ]);

      if (report.warnings.length > 0) {
        toast.warning('Sincronização concluída com avisos', {
          description: report.warnings[0],
        });
        return;
      }

      toast.success('Sincronização concluída', { description: summarizeReport(report) });
    },

    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'Não foi possível sincronizar agora';

      toast.error('Falha na sincronização', { description: message });
    },
  });
}

export function useConnectClassroom() {
  return useMutation({
    mutationFn: () => integrationService.connectClassroom(),
    onSuccess: ({ url }) => {
      // Navegação completa: o consentimento acontece no domínio do Google.
      window.location.href = url;
    },
    onError: () => toast.error('Não foi possível iniciar a conexão com o Google'),
  });
}

export function useDisconnectClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationService.disconnectClassroom(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.status });
      toast.success('Integração desconectada', {
        description: 'Os dados já importados continuam disponíveis.',
      });
    },
    onError: () => toast.error('Não foi possível desconectar'),
  });
}

// --- Google Calendar ------------------------------------------------------------

/** Resumo legível da sincronização do Calendar. */
export function summarizeCalendarReport(report: CalendarSyncReport): string {
  const parts: string[] = [];

  if (report.created > 0) parts.push(`${report.created} eventos novos`);
  if (report.updated > 0) parts.push(`${report.updated} atualizados`);
  if (report.removed > 0) parts.push(`${report.removed} removidos`);

  return parts.length > 0 ? parts.join(' · ') : 'Agenda já estava em dia';
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationService.syncCalendar(),

    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: integrationKeys.status }),
        queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
      ]);

      toast.success('Agenda sincronizada', { description: summarizeCalendarReport(report) });
    },

    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'Não foi possível sincronizar a agenda';

      toast.error('Falha na sincronização', { description: message });
    },
  });
}

export function useConnectCalendar() {
  return useMutation({
    mutationFn: () => integrationService.connectCalendar(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => toast.error('Não foi possível iniciar a conexão com o Google'),
  });
}

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationService.disconnectCalendar(),
    onSuccess: async ({ removedEvents }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: integrationKeys.status }),
        queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
      ]);

      toast.success('Google Calendar desconectado', {
        description:
          removedEvents > 0
            ? `${removedEvents} eventos importados foram removidos. Os seus continuam aqui.`
            : 'Seus eventos próprios continuam aqui.',
      });
    },
    onError: () => toast.error('Não foi possível desconectar'),
  });
}
