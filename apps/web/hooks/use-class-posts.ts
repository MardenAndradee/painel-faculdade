'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateClassPostInput, UpdateClassPostInput } from '@painel/shared';
import { classPostService } from '@/services/class-post.service';
import { classKeys } from './use-classes';
import { subjectKeys } from './use-subjects';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de publicações de turma (Etapa 21).
 *
 * Publicar/editar/excluir mexe em Atividades, Provas ou Calendário de cada
 * membro (o *fan-out*) - por isso as mutações também invalidam essas listas
 * e o dashboard, não só as chaves da própria turma.
 */

export const classPostKeys = {
  all: (classId: string) => ['classPosts', classId] as const,
  list: (classId: string) => ['classPosts', classId, 'list'] as const,
  upcoming: (classId: string, days: number) => ['classPosts', classId, 'upcoming', days] as const,
};

export function useClassPosts(classId: string) {
  return useQuery({
    queryKey: classPostKeys.list(classId),
    queryFn: () => classPostService.list(classId),
    enabled: Boolean(classId),
  });
}

export function useUpcomingClassPosts(classId: string, days = 7) {
  return useQuery({
    queryKey: classPostKeys.upcoming(classId, days),
    queryFn: () => classPostService.upcoming(classId, days),
    enabled: Boolean(classId),
  });
}

function useInvalidateClassPosts(classId: string) {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: classPostKeys.all(classId) }),
      queryClient.invalidateQueries({ queryKey: classKeys.detail(classId) }),
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['exams'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function usePublishClassPost(classId: string) {
  const invalidate = useInvalidateClassPosts(classId);

  return useMutation({
    mutationFn: (data: CreateClassPostInput) => classPostService.publish(classId, data),
    onSuccess: async (post) => {
      await invalidate();
      toast.success(`"${post.title}" publicado`, {
        description: `${post.copyCount} membro(s) já têm a cópia.`,
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível publicar'));
    },
  });
}

export function useUpdateClassPost(classId: string) {
  const invalidate = useInvalidateClassPosts(classId);

  return useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: UpdateClassPostInput }) =>
      classPostService.update(classId, postId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Publicação atualizada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível salvar as alterações'));
    },
  });
}

export function useRemoveClassPost(classId: string) {
  const invalidate = useInvalidateClassPosts(classId);

  return useMutation({
    mutationFn: (postId: string) => classPostService.remove(classId, postId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Publicação excluída', {
        description: 'Cópias já personalizadas por algum membro foram preservadas.',
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível excluir'));
    },
  });
}
