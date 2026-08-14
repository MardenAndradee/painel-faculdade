'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AddExamPrepMaterialInput,
  BulkCreateExamPrepItemsInput,
  CompleteStudySessionInput,
  CreateDeckInput,
  CreateExamPrepItemInput,
  UpdateExamPrepItemInput,
  UpdateExamPrepNotesInput,
} from '@painel/shared';
import { examPrepService } from '@/services/exam-prep.service';
import { deckService } from '@/services/flashcard.service';
import { studyPlanService } from '@/services/study-plan.service';
import { examKeys } from './use-exams';
import { flashcardKeys } from './use-flashcards';
import { studyPlanKeys } from './use-study-plan';
import { errorMessage } from '@/lib/api-error';

/** Hooks do Plano de Estudos (Etapa 27). */

export const examPrepKeys = {
  all: ['exam-preps'] as const,
  detail: (id: string) => ['exam-preps', 'detail', id] as const,
};

export function useExamPrep(id: string) {
  return useQuery({
    queryKey: examPrepKeys.detail(id),
    queryFn: () => examPrepService.getById(id),
    enabled: id.length > 0,
  });
}

/** Só busca quando o diálogo de exclusão abre - nunca precisa disso de antemão. */
export function useExamPrepDeletionPreview(examPrepId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...examPrepKeys.detail(examPrepId), 'deletion-preview'],
    queryFn: () => examPrepService.getDeletionPreview(examPrepId),
    enabled,
  });
}

/**
 * Exclui o plano. Quem chama decide pra onde navegar depois (a página do
 * plano deixa de existir) - o hook só cuida do pedido e de fazer o menu da
 * prova voltar a mostrar "Criar plano de estudo".
 */
export function useDeleteExamPrep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (examPrepId: string) => examPrepService.remove(examPrepId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: examKeys.all });
      toast.success('Plano de estudos excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir o plano')),
  });
}

/**
 * Cria o plano a partir de uma prova. Quem chama decide pra onde navegar no
 * `onSuccess` - o hook so cuida do pedido e de invalidar a lista de provas,
 * pra o menu trocar de "Criar" pra "Ver" quando o usuario voltar pra la.
 */
export function useCreateExamPrep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (examId: string) => examPrepService.create(examId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
    onError: (error) =>
      toast.error(errorMessage(error, 'Não foi possível criar o plano de estudos')),
  });
}

/** Invalida só o detalhe deste plano - as mutações de item não afetam a lista de provas. */
export function useInvalidateExamPrep(examPrepId: string) {
  const queryClient = useQueryClient();

  return (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: examPrepKeys.detail(examPrepId) });
}

export function useCreateExamPrepItem(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (data: CreateExamPrepItemInput) => examPrepService.createItem(examPrepId, data),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível adicionar o item')),
  });
}

export function useBulkCreateExamPrepItems(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (data: BulkCreateExamPrepItemsInput) =>
      examPrepService.bulkCreateItems(examPrepId, data),
    onSuccess: async (_, variables) => {
      await invalidate();
      toast.success(
        variables.titles.length === 1
          ? '1 item adicionado'
          : `${variables.titles.length} itens adicionados`,
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível adicionar os itens')),
  });
}

export function useUpdateExamPrepItem(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateExamPrepItemInput }) =>
      examPrepService.updateItem(itemId, data),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível atualizar o item')),
  });
}

export function useDeleteExamPrepItem(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (itemId: string) => examPrepService.deleteItem(itemId),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir o item')),
  });
}

/**
 * Autosave das anotações - sem invalidar o plano a cada save: o editor já
 * tem o estado mais novo localmente, refetch aqui só arriscaria sobrescrever
 * o que o aluno está digitando.
 */
export function useUpdateExamPrepNotes(examPrepId: string) {
  return useMutation({
    mutationFn: (data: UpdateExamPrepNotesInput) => examPrepService.updateNotes(examPrepId, data),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar a anotação')),
  });
}

export function useAddExamPrepMaterial(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (data: AddExamPrepMaterialInput) => examPrepService.addMaterial(examPrepId, data),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível vincular o material')),
  });
}

export function useRemoveExamPrepMaterial(examPrepId: string) {
  const invalidate = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (materialId: string) => examPrepService.removeMaterial(materialId),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível desvincular o material')),
  });
}

/**
 * Cria um baralho já vinculado ao plano (Etapa 8). Invalida tanto o cache de
 * flashcards (pra lista de baralhos do plano atualizar) quanto o do próprio
 * plano (pra `flashcards.deckCount` no resumo de progresso atualizar junto).
 */
export function useCreateExamPrepDeck(examPrepId: string) {
  const queryClient = useQueryClient();
  const invalidatePlan = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: (data: Omit<CreateDeckInput, 'examPrepId'>) =>
      deckService.create({ ...data, examPrepId }),
    onSuccess: async (deck) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: flashcardKeys.all }),
        invalidatePlan(),
      ]);
      toast.success(`Baralho "${deck.name}" criado`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o baralho')),
  });
}

/**
 * "Começar sessão" (Etapa 9): dispara um bloco `IN_PROGRESS` agora, com
 * título e disciplina herdados da prova. Invalida o cronograma (a sessão
 * também aparece lá) e o próprio plano (pra `activeStudySession` acender).
 */
export function useQuickStartExamPrepSession(examPrepId: string) {
  const queryClient = useQueryClient();
  const invalidatePlan = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: () => studyPlanService.quickStart({ examPrepId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studyPlanKeys.all }),
        invalidatePlan(),
      ]);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível começar a sessão')),
  });
}

/**
 * "Finalizar" (Etapa 9): reaproveita `POST /study-sessions/:id/complete` sem
 * mudar o contrato - o servidor já sabe calcular os minutos reais quando a
 * sessão é `IN_PROGRESS` (ver `study-plan.service.ts`).
 */
export function useCompleteExamPrepSession(examPrepId: string) {
  const queryClient = useQueryClient();
  const invalidatePlan = useInvalidateExamPrep(examPrepId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteStudySessionInput }) =>
      studyPlanService.complete(id, data),
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studyPlanKeys.all }),
        invalidatePlan(),
      ]);
      toast.success(`Você estudou por ${session.actualMinutes} minutos.`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível finalizar a sessão')),
  });
}
