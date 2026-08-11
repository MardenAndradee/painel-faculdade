'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks da central de notificacoes (Etapa 19). */

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

/**
 * Contagem do indicador do sino.
 *
 * Recarrega periodicamente porque o servidor gera as notificacoes de prazo na
 * propria consulta: sem isso, uma atividade que vence enquanto o app esta
 * aberto so apareceria depois de recarregar a pagina.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  });
}

/** `enabled` fica com quem chama: a lista só é buscada com o sino aberto. */
export function useNotifications(unreadOnly: boolean, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => notificationService.list({ perPage: 20, unreadOnly }),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    // Silencioso: marcar como lida é efeito colateral de clicar num item, e um
    // toast de sucesso a cada clique seria ruído.
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível marcar como lida')),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });

      if (result.read > 0) {
        toast.success(
          result.read === 1
            ? '1 notificação marcada como lida'
            : `${result.read} marcadas como lidas`,
        );
      }
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível marcar todas')),
  });
}
