'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateSubjectInput, UpdateSubjectInput } from '@painel/shared';
import { subjectService, teacherService, type SubjectListParams } from '@/services/subject.service';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de disciplinas.
 *
 * Toda mutacao invalida a listagem E o dashboard: criar ou excluir disciplina
 * muda a contagem e a media exibidas na tela inicial.
 */

export const subjectKeys = {
  all: ['subjects'] as const,
  list: (params: SubjectListParams) => ['subjects', 'list', params] as const,
  detail: (id: string) => ['subjects', 'detail', id] as const,
  deletionImpact: (id: string) => ['subjects', 'deletion-impact', id] as const,
  teachers: (search?: string) => ['teachers', search ?? ''] as const,
};

export function useSubjects(params: SubjectListParams) {
  return useQuery({
    queryKey: subjectKeys.list(params),
    queryFn: () => subjectService.list(params),
    // Mantem a página anterior visível durante a troca de filtro/página,
    // evitando o "pisca" de tela vazia entre requisições.
    placeholderData: (previous) => previous,
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: subjectKeys.detail(id),
    queryFn: () => subjectService.getById(id),
    enabled: Boolean(id),
  });
}

export function useTeachers(search?: string) {
  return useQuery({
    queryKey: subjectKeys.teachers(search),
    queryFn: () => teacherService.list(search),
    staleTime: 5 * 60 * 1000,
  });
}

/** Mensagem de erro amigável a partir da resposta da API. */
function useInvalidateSubjects() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useCreateSubject() {
  const invalidate = useInvalidateSubjects();

  return useMutation({
    mutationFn: (data: CreateSubjectInput) => subjectService.create(data),
    onSuccess: async (subject) => {
      await invalidate();
      toast.success(`Disciplina "${subject.name}" criada`);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível criar a disciplina'));
    },
  });
}

export function useUpdateSubject() {
  const invalidate = useInvalidateSubjects();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubjectInput }) =>
      subjectService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina atualizada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível salvar as alterações'));
    },
  });
}

export function useArchiveSubject() {
  const invalidate = useInvalidateSubjects();

  return useMutation({
    mutationFn: (id: string) => subjectService.archive(id),
    onSuccess: async (subject) => {
      await invalidate();
      toast.success(`"${subject.name}" arquivada`, {
        description: 'Provas, notas e materiais foram preservados.',
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível arquivar'));
    },
  });
}

export function useRestoreSubject() {
  const invalidate = useInvalidateSubjects();

  return useMutation({
    mutationFn: (id: string) => subjectService.restore(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina restaurada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível restaurar'));
    },
  });
}

export function useDeleteSubject() {
  const invalidate = useInvalidateSubjects();

  return useMutation({
    mutationFn: (id: string) => subjectService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina excluída permanentemente');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível excluir'));
    },
  });
}

/** Carrega o impacto sob demanda, só quando o diálogo de exclusão abre. */
export function useDeletionImpact(id: string, enabled: boolean) {
  return useQuery({
    queryKey: subjectKeys.deletionImpact(id),
    queryFn: () => subjectService.deletionImpact(id),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}
