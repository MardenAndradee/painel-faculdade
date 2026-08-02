import {
  buildPaginationMeta,
  type BulkCreateFlashcardsInput,
  type CreateFlashcardInput,
  type FlashcardListItem,
  type FlashcardQuery,
  type FlashcardStats,
  type PaginatedResult,
  type ReviewFlashcardInput,
  type ReviewResult,
  type StudyCard,
  type StudyQueue,
  type StudyQueueQuery,
  type UpdateFlashcardInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  flashcardRepository,
  type FlashcardRow,
  type StudyCardRow,
} from '../repositories/flashcard.repository.js';
import { deckRepository } from '../repositories/deck.repository.js';
import { AppError } from '../utils/app-error.js';
import { previewIntervals, scheduleNextReview } from '../utils/spaced-repetition.js';
import { MASTERED_INTERVAL_DAYS } from './deck.service.js';
import { emptyToNull } from '../utils/text.js';

/** Regra de negocio de cartoes e do estudo. */

function toListItem(row: FlashcardRow, now: Date): FlashcardListItem {
  return {
    id: row.id,
    deckId: row.deckId,
    front: row.front,
    back: row.back,
    hint: row.hint,
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    dueDate: row.dueDate?.toISOString() ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    totalReviews: row.totalReviews,
    lapses: row.lapses,
    isDue: row.dueDate === null || row.dueDate <= now,
    isNew: row.dueDate === null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStudyCard(row: StudyCardRow, now: Date): StudyCard {
  return {
    ...toListItem(row, now),
    deck: row.deck,
    /**
     * A previsao acompanha o cartao porque quem sabe calcular e o servidor.
     * Duplicar o SM-2 no cliente so para escrever "6 dias" no botao criaria
     * duas implementacoes que iriam divergir na primeira mudanca.
     */
    intervalPreview: previewIntervals(
      {
        easeFactor: row.easeFactor,
        intervalDays: row.intervalDays,
        repetitions: row.repetitions,
      },
      now,
    ),
  };
}

/**
 * Confirma que o baralho existe e pertence ao usuario.
 *
 * O status depende de ONDE veio o id, e a distincao importa para o cliente:
 * - no caminho da URL (`/decks/:id/cards`) o baralho e o proprio recurso
 *   pedido, entao a ausencia dele e 404;
 * - no corpo ou na query (`{ deckId }`, `?deckId=`) ele e uma referencia
 *   dentro de um pedido valido, e o que esta errado e o dado enviado: 400.
 */
async function assertDeckOwnership(
  userId: string,
  deckId: string,
  source: 'path' | 'payload' = 'payload',
): Promise<void> {
  if (await deckRepository.findById(userId, deckId)) return;

  throw source === 'path' ? AppError.notFound('Baralho') : AppError.badRequest('Baralho inválido');
}

/** Meia-noite de hoje, usada como corte das contagens do dia. */
function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  return start;
}

/**
 * Sequencia de dias seguidos com revisao.
 *
 * Conta a partir de hoje; se o aluno ainda nao estudou hoje, a sequencia
 * continua valendo ate o fim do dia - zera-la as 00h01 puniria quem estuda a
 * noite. Por isso ontem tambem serve de ponto de partida.
 */
function calculateStreak(reviewDays: Date[], now: Date): number {
  if (reviewDays.length === 0) return 0;

  const toDayKey = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const days = new Set(reviewDays.map(toDayKey));
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const today = toDayKey(now);
  let cursor = days.has(today) ? today : today - MS_PER_DAY;

  // Sem revisao hoje nem ontem, a sequencia ja foi quebrada.
  if (!days.has(cursor)) return 0;

  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor -= MS_PER_DAY;
  }

  return streak;
}

export const flashcardService = {
  async list(
    userId: string,
    deckId: string,
    query: FlashcardQuery,
  ): Promise<PaginatedResult<FlashcardListItem>> {
    await assertDeckOwnership(userId, deckId, 'path');

    const now = new Date();
    const skip = (query.page - 1) * query.perPage;

    const { rows, total } = await flashcardRepository.findPaginated(
      userId,
      { deckId, view: query.view, search: query.search },
      skip,
      query.perPage,
      now,
      MASTERED_INTERVAL_DAYS,
    );

    return {
      data: rows.map((row) => toListItem(row, now)),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  async create(userId: string, input: CreateFlashcardInput): Promise<FlashcardListItem> {
    await assertDeckOwnership(userId, input.deckId);

    const row = await flashcardRepository.create(userId, {
      deckId: input.deckId,
      front: input.front,
      back: input.back,
      hint: emptyToNull(input.hint),
    });

    return toListItem(row, new Date());
  },

  /** Criacao em lote, usada pela importacao de texto. */
  async createMany(userId: string, input: BulkCreateFlashcardsInput): Promise<{ created: number }> {
    await assertDeckOwnership(userId, input.deckId);

    const result = await flashcardRepository.createMany(
      userId,
      input.deckId,
      input.cards.map((card) => ({
        front: card.front,
        back: card.back,
        hint: emptyToNull(card.hint),
      })),
    );

    return { created: result.count };
  },

  async update(
    userId: string,
    id: string,
    input: UpdateFlashcardInput,
  ): Promise<FlashcardListItem> {
    const data: Prisma.FlashcardUncheckedUpdateInput = {};

    if (input.front !== undefined) data.front = input.front;
    if (input.back !== undefined) data.back = input.back;
    if (input.hint !== undefined) data.hint = emptyToNull(input.hint);

    const row = await flashcardRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Cartão');

    return toListItem(row, new Date());
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await flashcardRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Cartão');
  },

  /**
   * Devolve a fila de estudo.
   *
   * `totalDue` vem separado do tamanho da fila de proposito: o aluno precisa
   * saber que restam 80 cartoes mesmo quando a sessao entrega 20.
   */
  async studyQueue(userId: string, query: StudyQueueQuery): Promise<StudyQueue> {
    if (query.deckId) await assertDeckOwnership(userId, query.deckId);

    const now = new Date();
    const includeNew = query.includeNew !== 'false' && query.includeNew !== false;

    const [rows, counts] = await Promise.all([
      flashcardRepository.findDueCards(userId, now, query.limit, {
        deckId: query.deckId,
        includeNew,
      }),
      flashcardRepository.countDue(userId, now, query.deckId),
    ]);

    return {
      cards: rows.map((row) => toStudyCard(row, now)),
      totalDue: counts.due,
      totalNew: counts.new,
    };
  },

  /**
   * Aplica uma avaliacao.
   *
   * O agendamento e responsabilidade exclusiva do servidor: o cliente envia a
   * nota e recebe o cartao ja reagendado. Deixar o calculo no cliente
   * permitiria a qualquer requisicao forjar um intervalo.
   */
  async review(userId: string, cardId: string, input: ReviewFlashcardInput): Promise<ReviewResult> {
    const current = await flashcardRepository.findById(userId, cardId);

    if (!current) throw AppError.notFound('Cartão');

    const now = new Date();

    const next = scheduleNextReview(
      {
        easeFactor: current.easeFactor,
        intervalDays: current.intervalDays,
        repetitions: current.repetitions,
      },
      input.quality,
      now,
    );

    const updated = await flashcardRepository.applyReview(
      userId,
      cardId,
      {
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueDate: next.dueDate,
        lastReviewedAt: now,
        totalReviews: { increment: 1 },
        ...(next.isLapse ? { lapses: { increment: 1 } } : {}),
      },
      {
        quality: input.quality,
        intervalDays: next.intervalDays,
        durationMs: input.durationMs ?? null,
      },
    );

    if (!updated) throw AppError.notFound('Cartão');

    const remaining = await flashcardRepository.countDue(userId, now, current.deckId);

    return {
      card: toListItem(updated, now),
      remaining: remaining.due + remaining.new,
    };
  },

  async stats(userId: string): Promise<FlashcardStats> {
    const now = new Date();

    const [summary, reviewDays] = await Promise.all([
      flashcardRepository.summarize(userId, now, startOfToday(now), MASTERED_INTERVAL_DAYS),
      // 365 revisoes cobrem com folga a sequencia mais longa plausivel sem
      // trazer o log inteiro para a memoria.
      flashcardRepository.findReviewDays(userId, 365),
    ]);

    return {
      totalCards: summary.totalCards,
      // Cartoes novos tambem precisam de atencao hoje, entao entram no numero
      // que a tela chama de "para revisar".
      dueToday: summary.dueToday + summary.newCards,
      newCards: summary.newCards,
      masteredCards: summary.masteredCards,
      reviewedToday: summary.reviewedToday,
      streakDays: calculateStreak(reviewDays, now),
      retentionRate:
        summary.totalReviews === 0
          ? null
          : Math.round((summary.passedReviews / summary.totalReviews) * 100),
    };
  },
};
