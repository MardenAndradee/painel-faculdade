'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateExamInput, UpdateExamInput } from '@painel/shared';
import { examService, type ExamListParams } from '@/services/exam.service';
import { dashboardKeys } from './use-dashboard';
import { subjectKeys } from './use-subjects';
import { errorMessage } from '@/lib/api-error';

/** Hooks de provas. Mutacoes invalidam provas, dashboard e disciplinas. */

export const examKeys = {
  all: ['exams'] as const,
  list: (params: ExamListParams) => ['exams', 'list', params] as const,
  counts: (subjectId?: string) => ['exams', 'counts', subjectId ?? ''] as const,
};

export function useExams(params: ExamListParams) {
  return useQuery({
    queryKey: examKeys.list(params),
    queryFn: () => examService.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useExamCounts(subjectId?: string) {
  return useQuery({
    queryKey: examKeys.counts(subjectId),
    queryFn: () => examService.counts(subjectId),
  });
}

function useInvalidateAll() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: examKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
    ]);
  };
}

export function useCreateExam() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (data: CreateExamInput) => examService.create(data),
    onSuccess: async (exam) => {
      await invalidate();
      toast.success(`Prova "${exam.title}" cadastrada`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível cadastrar a prova')),
  });
}

export function useUpdateExam() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExamInput }) =>
      examService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Prova atualizada');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useDeleteExam() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => examService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Prova excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
