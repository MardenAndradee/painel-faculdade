'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '@painel/shared';
import { calendarService } from '@/services/calendar.service';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/** Hooks do calendario. */

export const calendarKeys = {
  all: ['calendar'] as const,
  agenda: (from: string, to: string, includeCompleted: boolean) =>
    ['calendar', 'agenda', from, to, includeCompleted] as const,
};

export function useAgenda(from: Date, to: Date, includeCompleted: boolean) {
  return useQuery({
    // As chaves usam ISO para que trocar de mes gere entradas distintas de cache.
    queryKey: calendarKeys.agenda(from.toISOString(), to.toISOString(), includeCompleted),
    queryFn: () => calendarService.agenda(from, to, includeCompleted),
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  });
}

function useInvalidateCalendar() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useCreateEvent() {
  const invalidate = useInvalidateCalendar();

  return useMutation({
    mutationFn: (data: CreateCalendarEventInput) => calendarService.createEvent(data),
    onSuccess: async (event) => {
      await invalidate();
      toast.success(`"${event.title}" adicionado à agenda`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o evento')),
  });
}

export function useUpdateEvent() {
  const invalidate = useInvalidateCalendar();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCalendarEventInput }) =>
      calendarService.updateEvent(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Evento atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateCalendar();

  return useMutation({
    mutationFn: (id: string) => calendarService.removeEvent(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Evento excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
