'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  BulkCreateFlashcardsInput,
  CreateDeckInput,
  CreateFlashcardInput,
  DeckQuery,
  FlashcardQuery,
  ReviewFlashcardInput,
  UpdateDeckInput,
  UpdateFlashcardInput,
} from '@painel/shared';
import { deckService, flashcardService } from '@/services/flashcard.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de flashcards. */

export const flashcardKeys = {
  all: ['flashcards'] as const,
  decks: (query: DeckQuery) => ['flashcards', 'decks', query] as const,
  deck: (id: string) => ['flashcards', 'deck', id] as const,
  cards: (deckId: string, query: Partial<FlashcardQuery>) =>
    ['flashcards', 'cards', deckId, query] as const,
  queue: (deckId: string | undefined) => ['flashcards', 'queue', deckId ?? 'todos'] as const,
  stats: ['flashcards', 'stats'] as const,
};

export function useDecks(query: DeckQuery = {}) {
  return useQuery({
    queryKey: flashcardKeys.decks(query),
    queryFn: () => deckService.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useDeck(id: string) {
  return useQuery({
    queryKey: flashcardKeys.deck(id),
    queryFn: () => deckService.getById(id),
    enabled: Boolean(id),
  });
}

export function useDeckCards(deckId: string, query: Partial<FlashcardQuery>) {
  return useQuery({
    queryKey: flashcardKeys.cards(deckId, query),
    queryFn: () => flashcardService.listByDeck(deckId, query),
    enabled: Boolean(deckId),
    placeholderData: (previous) => previous,
  });
}

/**
 * Fila de estudo.
 *
 * `staleTime: 0` e `refetchOnMount: 'always'`: entrar no modo de estudo precisa
 * buscar a fila do zero. Reaproveitar cache traria cartoes que ja foram
 * revisados em outra aba ou numa sessao anterior do mesmo dia.
 */
export function useStudyQueue(deckId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: flashcardKeys.queue(deckId),
    queryFn: () => flashcardService.queue({ deckId, limit }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useFlashcardStats() {
  return useQuery({
    queryKey: flashcardKeys.stats,
    queryFn: () => flashcardService.stats(),
  });
}

function useInvalidateFlashcards() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
  };
}

export function useCreateDeck() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: (data: CreateDeckInput) => deckService.create(data),
    onSuccess: async (deck) => {
      await invalidate();
      toast.success(`Baralho ${deck.name} criado`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o baralho')),
  });
}

export function useUpdateDeck() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeckInput }) =>
      deckService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Baralho atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useArchiveDeck() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      deckService.setArchived(id, archived),
    onSuccess: async (deck) => {
      await invalidate();
      toast.success(deck.archivedAt ? 'Baralho arquivado' : 'Baralho reativado', {
        description: deck.archivedAt
          ? 'Ele sai da fila de estudo, mas os cartões ficam.'
          : undefined,
      });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível arquivar')),
  });
}

export function useDeleteDeck() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: (id: string) => deckService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Baralho excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}

export function useCreateFlashcard() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: (data: CreateFlashcardInput) => flashcardService.create(data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Cartão criado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o cartão')),
  });
}

export function useCreateFlashcards() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: (data: BulkCreateFlashcardsInput) => flashcardService.createMany(data),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(
        result.created === 1 ? '1 cartão importado' : `${result.created} cartões importados`,
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível importar')),
  });
}

export function useUpdateFlashcard() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFlashcardInput }) =>
      flashcardService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Cartão atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useDeleteFlashcard() {
  const invalidate = useInvalidateFlashcards();

  return useMutation({
    mutationFn: (id: string) => flashcardService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Cartão excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}

/**
 * Avaliacao de um cartao durante o estudo.
 *
 * Nao invalida nada no `onSuccess`: refazer a consulta da fila no meio da
 * sessao trocaria os cartoes debaixo do usuario. A tela avanca com o proprio
 * estado local e so invalida ao terminar.
 */
export function useReviewFlashcard() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewFlashcardInput }) =>
      flashcardService.review(id, data),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível registrar a resposta')),
  });
}

/** Usado ao encerrar a sessão, quando refazer as consultas é justamente o certo. */
export function useInvalidateFlashcardData() {
  return useInvalidateFlashcards();
}
