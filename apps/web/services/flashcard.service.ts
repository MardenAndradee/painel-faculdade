import type {
  BulkCreateFlashcardsInput,
  CreateDeckInput,
  CreateFlashcardInput,
  DeckListItem,
  DeckQuery,
  FlashcardListItem,
  FlashcardQuery,
  FlashcardStats,
  PaginationMeta,
  ReviewFlashcardInput,
  ReviewResult,
  StudyQueue,
  UpdateDeckInput,
  UpdateFlashcardInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const deckService = {
  list(query: DeckQuery = {}): Promise<DeckListItem[]> {
    return httpClient.get<DeckListItem[]>('/decks', {
      query: { search: query.search, subjectId: query.subjectId, examPrepId: query.examPrepId },
    });
  },

  getById(id: string): Promise<DeckListItem> {
    return httpClient.get<DeckListItem>(`/decks/${id}`);
  },

  create(data: CreateDeckInput): Promise<DeckListItem> {
    return httpClient.post<DeckListItem>('/decks', data);
  },

  update(id: string, data: UpdateDeckInput): Promise<DeckListItem> {
    return httpClient.patch<DeckListItem>(`/decks/${id}`, data);
  },

  setArchived(id: string, archived: boolean): Promise<DeckListItem> {
    return httpClient.post<DeckListItem>(`/decks/${id}/${archived ? 'archive' : 'unarchive'}`);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/decks/${id}`);
  },
};

export const flashcardService = {
  listByDeck(
    deckId: string,
    query: Partial<FlashcardQuery>,
  ): Promise<{ data: FlashcardListItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<FlashcardListItem>(`/decks/${deckId}/cards`, {
      query: {
        page: query.page,
        perPage: query.perPage,
        view: query.view,
        search: query.search,
      },
    });
  },

  create(data: CreateFlashcardInput): Promise<FlashcardListItem> {
    return httpClient.post<FlashcardListItem>('/flashcards', data);
  },

  createMany(data: BulkCreateFlashcardsInput): Promise<{ created: number }> {
    return httpClient.post<{ created: number }>('/flashcards/bulk', data);
  },

  update(id: string, data: UpdateFlashcardInput): Promise<FlashcardListItem> {
    return httpClient.patch<FlashcardListItem>(`/flashcards/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/flashcards/${id}`);
  },

  queue(params: { deckId?: string; limit?: number }): Promise<StudyQueue> {
    return httpClient.get<StudyQueue>('/flashcards/queue', {
      query: { deckId: params.deckId, limit: params.limit },
    });
  },

  review(id: string, data: ReviewFlashcardInput): Promise<ReviewResult> {
    return httpClient.post<ReviewResult>(`/flashcards/${id}/review`, data);
  },

  stats(): Promise<FlashcardStats> {
    return httpClient.get<FlashcardStats>('/flashcards/stats');
  },
};
