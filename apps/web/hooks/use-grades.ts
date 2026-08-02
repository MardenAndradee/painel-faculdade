'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateGradeInput, UpdateGradeInput } from '@painel/shared';
import { gradeService } from '@/services/grade.service';
import { subjectKeys } from './use-subjects';
import { examKeys } from './use-exams';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de notas.
 *
 * Toda mutacao invalida notas, disciplinas, provas E dashboard: lancar uma
 * nota muda a media exibida em todos esses lugares.
 */

export const gradeKeys = {
  all: ['grades'] as const,
  overview: ['grades', 'overview'] as const,
  subject: (subjectId: string) => ['grades', 'subject', subjectId] as const,
};

export function useGradesOverview() {
  return useQuery({
    queryKey: gradeKeys.overview,
    queryFn: () => gradeService.overview(),
  });
}

export function useSubjectGrades(subjectId: string) {
  return useQuery({
    queryKey: gradeKeys.subject(subjectId),
    queryFn: () => gradeService.subjectSummary(subjectId),
    enabled: Boolean(subjectId),
  });
}

function useInvalidateGrades() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gradeKeys.all }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: examKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useCreateGrade() {
  const invalidate = useInvalidateGrades();

  return useMutation({
    mutationFn: (data: CreateGradeInput) => gradeService.create(data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Nota lançada');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível lançar a nota')),
  });
}

export function useUpdateGrade() {
  const invalidate = useInvalidateGrades();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGradeInput }) =>
      gradeService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Nota atualizada');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useDeleteGrade() {
  const invalidate = useInvalidateGrades();

  return useMutation({
    mutationFn: (id: string) => gradeService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Nota excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
