'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CompleteStudySessionInput,
  CreateStudySessionInput,
  GeneratePlanInput,
  SaveAvailabilityInput,
  UpdateStudySessionInput,
} from '@painel/shared';
import { studyPlanService } from '@/services/study-plan.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks do cronograma de estudos. */

export const studyPlanKeys = {
  all: ['study-plan'] as const,
  availability: ['study-plan', 'availability'] as const,
  summary: ['study-plan', 'summary'] as const,
  sessions: (from: string, to: string) => ['study-plan', 'sessions', from, to] as const,
};

export function useAvailability() {
  return useQuery({
    queryKey: studyPlanKeys.availability,
    queryFn: () => studyPlanService.availability(),
  });
}

export function useStudyPlanSummary() {
  return useQuery({
    queryKey: studyPlanKeys.summary,
    queryFn: () => studyPlanService.summary(),
  });
}

export function useStudySessions(from: Date, to: Date) {
  return useQuery({
    queryKey: studyPlanKeys.sessions(from.toISOString(), to.toISOString()),
    queryFn: () => studyPlanService.list(from, to),
    // Mantém a semana anterior visível durante a navegação, evitando o "pisca"
    // de tela vazia a cada troca de período.
    placeholderData: (previous) => previous,
  });
}

function useInvalidatePlan() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: studyPlanKeys.all });
  };
}

export function useSaveAvailability() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (data: SaveAvailabilityInput) => studyPlanService.saveAvailability(data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disponibilidade salva', {
        description: 'Gere o cronograma para preencher os novos horários.',
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

/**
 * Geracao do cronograma.
 *
 * Zero blocos criados nao e erro - pode simplesmente nao haver nada pendente.
 * O aviso repassa o motivo que o servidor devolveu, senao o usuario clicaria
 * de novo sem entender o que faltou.
 */
export function useGeneratePlan() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (data: GeneratePlanInput) => studyPlanService.generate(data),
    onSuccess: async (result) => {
      await invalidate();

      if (result.created === 0) {
        toast.warning('Nenhum bloco foi criado', {
          description:
            result.unscheduled[0]?.reason ?? 'Não há provas ou atividades pendentes no período.',
        });
        return;
      }

      toast.success(
        result.created === 1 ? '1 bloco de estudo criado' : `${result.created} blocos criados`,
        {
          description:
            result.preserved > 0
              ? `${result.preserved} bloco(s) seu(s) foram preservados.`
              : undefined,
        },
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível gerar o cronograma')),
  });
}

export function useCreateStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (data: CreateStudySessionInput) => studyPlanService.create(data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Bloco criado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o bloco')),
  });
}

export function useUpdateStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStudySessionInput }) =>
      studyPlanService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Bloco atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useCompleteStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteStudySessionInput }) =>
      studyPlanService.complete(id, data),
    onSuccess: async (session) => {
      await invalidate();
      toast.success('Bloco concluído', {
        description: `${session.actualMinutes} minutos registrados.`,
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível concluir')),
  });
}

export function useSkipStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (id: string) => studyPlanService.skip(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Bloco pulado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível pular')),
  });
}

export function useReopenStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (id: string) => studyPlanService.reopen(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Bloco reaberto');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível reabrir')),
  });
}

export function useDeleteStudySession() {
  const invalidate = useInvalidatePlan();

  return useMutation({
    mutationFn: (id: string) => studyPlanService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Bloco excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}
