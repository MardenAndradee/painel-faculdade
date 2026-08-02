'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AssignmentListItem,
  CreateAssignmentInput,
  PaginationMeta,
  UpdateAssignmentInput,
} from '@painel/shared';
import { assignmentService, type AssignmentListParams } from '@/services/assignment.service';
import { dashboardKeys } from './use-dashboard';
import { subjectKeys } from './use-subjects';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de atividades.
 *
 * Toda mutacao invalida atividades, dashboard E disciplinas: concluir uma
 * atividade muda a contagem de pendentes nos tres lugares.
 */

export const assignmentKeys = {
  all: ['assignments'] as const,
  list: (params: AssignmentListParams) => ['assignments', 'list', params] as const,
  counts: (subjectId?: string) => ['assignments', 'counts', subjectId ?? ''] as const,
};

export function useAssignments(params: AssignmentListParams) {
  return useQuery({
    queryKey: assignmentKeys.list(params),
    queryFn: () => assignmentService.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useAssignmentCounts(subjectId?: string) {
  return useQuery({
    queryKey: assignmentKeys.counts(subjectId),
    queryFn: () => assignmentService.counts(subjectId),
  });
}

function useInvalidateAll() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
    ]);
  };
}

export function useCreateAssignment() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (data: CreateAssignmentInput) => assignmentService.create(data),
    onSuccess: async (assignment) => {
      await invalidate();
      toast.success(`"${assignment.title}" criada`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar a atividade')),
  });
}

export function useUpdateAssignment() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssignmentInput }) =>
      assignmentService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Atividade atualizada');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

/**
 * Conclui ou reabre uma atividade.
 *
 * Atualiza a lista otimisticamente: marcar um checkbox precisa responder na
 * hora. Se a API falhar, o estado anterior e restaurado.
 */
export function useToggleComplete() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => assignmentService.toggleComplete(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: assignmentKeys.all });

      const snapshots = queryClient.getQueriesData<{
        data: AssignmentListItem[];
        meta: PaginationMeta;
      }>({ queryKey: ['assignments', 'list'] });

      for (const [key, value] of snapshots) {
        if (!value) continue;

        queryClient.setQueryData(key, {
          ...value,
          data: value.data.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status:
                    item.status === 'COMPLETED' ? ('PENDING' as const) : ('COMPLETED' as const),
                  completedAt: item.status === 'COMPLETED' ? null : new Date().toISOString(),
                  isOverdue: item.status === 'COMPLETED' ? item.isOverdue : false,
                }
              : item,
          ),
        });
      }

      return { snapshots };
    },

    onError: (error, _id, context) => {
      // Restaura exatamente o que havia antes da atualizacao otimista.
      for (const [key, value] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, value);
      }

      toast.error(errorMessage(error, 'Não foi possível atualizar a atividade'));
    },

    onSuccess: (assignment) => {
      if (assignment.status === 'COMPLETED') {
        toast.success(`"${assignment.title}" concluída`);
      }
    },

    onSettled: async () => {
      await invalidate();
    },
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => assignmentService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Atividade excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
