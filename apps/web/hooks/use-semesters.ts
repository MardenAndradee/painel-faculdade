'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateSemesterInput, UpdateSemesterInput } from '@painel/shared';
import { semesterService } from '@/services/semester.service';
import { subjectKeys } from './use-subjects';
import { gradeKeys } from './use-grades';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/** Hooks de semestres e historico. */

export const semesterKeys = {
  all: ['semesters'] as const,
  history: ['history'] as const,
  closePreview: (id: string) => ['semesters', 'close-preview', id] as const,
};

export function useHistory() {
  return useQuery({
    queryKey: semesterKeys.history,
    queryFn: () => semesterService.history(),
  });
}

export function useSemesters() {
  return useQuery({
    queryKey: semesterKeys.all,
    queryFn: () => semesterService.list(),
  });
}

/** Carrega a prévia só quando o diálogo de encerramento abre. */
export function useClosePreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: semesterKeys.closePreview(id),
    queryFn: () => semesterService.closePreview(id),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}

/**
 * Encerrar e reabrir mexem em `finalGrade` e no status das disciplinas —
 * o que muda médias no boletim, nas disciplinas e no dashboard.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: semesterKeys.all }),
      queryClient.invalidateQueries({ queryKey: semesterKeys.history }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: gradeKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useCreateSemester() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (data: CreateSemesterInput) => semesterService.create(data),
    onSuccess: async (semester) => {
      await invalidate();
      toast.success(`Semestre ${semester.name} criado`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o semestre')),
  });
}

export function useUpdateSemester() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSemesterInput }) =>
      semesterService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Semestre atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useCloseSemester() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => semesterService.close(id),
    onSuccess: async (semester) => {
      await invalidate();
      toast.success(`Semestre ${semester.name} encerrado`, {
        description: 'As médias finais foram consolidadas.',
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível encerrar')),
  });
}

export function useReopenSemester() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => semesterService.reopen(id),
    onSuccess: async (semester) => {
      await invalidate();
      toast.success(`Semestre ${semester.name} reaberto`, {
        description: 'As médias voltam a ser calculadas pelas notas lançadas.',
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível reabrir')),
  });
}

export function useDeleteSemester() {
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (id: string) => semesterService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Semestre excluído', {
        description: 'As disciplinas foram preservadas, sem período atribuído.',
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
