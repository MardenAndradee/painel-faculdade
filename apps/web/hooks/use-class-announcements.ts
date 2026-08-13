'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateClassAnnouncementInput, UpdateClassAnnouncementInput } from '@painel/shared';
import { classAnnouncementService } from '@/services/class-announcement.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de avisos do Mural (Etapa 22). */

export const classAnnouncementKeys = {
  list: (classId: string) => ['classAnnouncements', classId] as const,
};

export function useClassAnnouncements(classId: string) {
  return useQuery({
    queryKey: classAnnouncementKeys.list(classId),
    queryFn: () => classAnnouncementService.list(classId),
    enabled: Boolean(classId),
  });
}

function useInvalidateClassAnnouncements(classId: string) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: classAnnouncementKeys.list(classId) });
}

export function useCreateClassAnnouncement(classId: string) {
  const invalidate = useInvalidateClassAnnouncements(classId);

  return useMutation({
    mutationFn: (data: CreateClassAnnouncementInput) =>
      classAnnouncementService.create(classId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Aviso publicado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível publicar o aviso')),
  });
}

export function useUpdateClassAnnouncement(classId: string) {
  const invalidate = useInvalidateClassAnnouncements(classId);

  return useMutation({
    mutationFn: ({
      announcementId,
      data,
    }: {
      announcementId: string;
      data: UpdateClassAnnouncementInput;
    }) => classAnnouncementService.update(classId, announcementId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Aviso atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar o aviso')),
  });
}

export function useRemoveClassAnnouncement(classId: string) {
  const invalidate = useInvalidateClassAnnouncements(classId);

  return useMutation({
    mutationFn: (announcementId: string) =>
      classAnnouncementService.remove(classId, announcementId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Aviso excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir o aviso')),
  });
}
