import type { FlashcardView } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de cartoes. */

const listSelect = {
  id: true,
  deckId: true,
  front: true,
  back: true,
  hint: true,
  easeFactor: true,
  intervalDays: true,
  repetitions: true,
  dueDate: true,
  lastReviewedAt: true,
  totalReviews: true,
  lapses: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FlashcardSelect;

export type FlashcardRow = Prisma.FlashcardGetPayload<{ select: typeof listSelect }>;

/** Projecao do estudo: traz o baralho junto para o cabecalho da tela. */
const studySelect = {
  ...listSelect,
  deck: { select: { id: true, name: true, color: true } },
} satisfies Prisma.FlashcardSelect;

export type StudyCardRow = Prisma.FlashcardGetPayload<{ select: typeof studySelect }>;

export interface FlashcardFilters {
  deckId: string;
  view: FlashcardView;
  search?: string | undefined;
}

/**
 * Condicao "vencido".
 *
 * Cartao nunca estudado (`dueDate` nulo) tambem entra: ele nunca vai vencer se
 * ninguem o mostrar uma primeira vez.
 */
function dueCondition(now: Date): Prisma.FlashcardWhereInput {
  return { OR: [{ dueDate: null }, { dueDate: { lte: now } }] };
}

function viewCondition(
  view: FlashcardView,
  now: Date,
  masteredIntervalDays: number,
): Prisma.FlashcardWhereInput {
  switch (view) {
    case 'pendentes':
      return dueCondition(now);

    case 'novos':
      return { dueDate: null };

    case 'dominados':
      return { intervalDays: { gte: masteredIntervalDays } };

    case 'todos':
    default:
      return {};
  }
}

function buildWhere(
  userId: string,
  filters: FlashcardFilters,
  now: Date,
  masteredIntervalDays: number,
): Prisma.FlashcardWhereInput {
  const conditions: Prisma.FlashcardWhereInput[] = [
    { userId, deckId: filters.deckId },
    viewCondition(filters.view, now, masteredIntervalDays),
  ];

  if (filters.search) {
    conditions.push({
      OR: [
        { front: { contains: filters.search, mode: 'insensitive' } },
        { back: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: conditions };
}

export const flashcardRepository = {
  async findPaginated(
    userId: string,
    filters: FlashcardFilters,
    skip: number,
    take: number,
    now: Date,
    masteredIntervalDays: number,
  ): Promise<{ rows: FlashcardRow[]; total: number }> {
    const where = buildWhere(userId, filters, now, masteredIntervalDays);

    const [rows, total] = await prisma.$transaction([
      prisma.flashcard.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'asc' }],
        skip,
        take,
      }),
      prisma.flashcard.count({ where }),
    ]);

    return { rows, total };
  },

  findById(userId: string, id: string): Promise<FlashcardRow | null> {
    return prisma.flashcard.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.FlashcardUncheckedCreateInput, 'userId'>,
  ): Promise<FlashcardRow> {
    return prisma.flashcard.create({ data: { ...data, userId }, select: listSelect });
  },

  createMany(
    userId: string,
    deckId: string,
    cards: { front: string; back: string; hint: string | null }[],
  ): Promise<{ count: number }> {
    return prisma.flashcard.createMany({
      data: cards.map((card) => ({ ...card, userId, deckId })),
    });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.FlashcardUncheckedUpdateInput,
  ): Promise<FlashcardRow | null> {
    const result = await prisma.flashcard.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.flashcard.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /**
   * Fila de estudo.
   *
   * Ordem deliberada: os vencidos ha mais tempo primeiro, e os novos por
   * ultimo. Mostrar cartoes novos antes dos atrasados infla a carga futura -
   * o aluno acumula divida enquanto conhece material inedito.
   */
  findDueCards(
    userId: string,
    now: Date,
    limit: number,
    options: { deckId?: string | undefined; includeNew: boolean },
  ): Promise<StudyCardRow[]> {
    const where: Prisma.FlashcardWhereInput = {
      userId,
      ...(options.deckId ? { deckId: options.deckId } : {}),
      ...(options.includeNew ? dueCondition(now) : { dueDate: { lte: now } }),
    };

    return prisma.flashcard.findMany({
      where,
      select: studySelect,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: limit,
    });
  },

  async countDue(
    userId: string,
    now: Date,
    deckId?: string,
  ): Promise<{ due: number; new: number }> {
    const base: Prisma.FlashcardWhereInput = { userId, ...(deckId ? { deckId } : {}) };

    const [due, novos] = await prisma.$transaction([
      prisma.flashcard.count({ where: { ...base, dueDate: { lte: now } } }),
      prisma.flashcard.count({ where: { ...base, dueDate: null } }),
    ]);

    return { due, new: novos };
  },

  /**
   * Grava a revisao e o novo estado do cartao numa transacao.
   *
   * As duas escritas precisam cair juntas: um log sem a atualizacao faria o
   * cartao reaparecer na fila; a atualizacao sem log perderia o historico que
   * as Estatisticas leem.
   */
  async applyReview(
    userId: string,
    cardId: string,
    state: Prisma.FlashcardUncheckedUpdateInput,
    review: { quality: number; intervalDays: number; durationMs: number | null },
  ): Promise<FlashcardRow | null> {
    const [updated] = await prisma.$transaction([
      prisma.flashcard.updateMany({ where: { id: cardId, userId }, data: state }),
      prisma.flashcardReview.create({
        data: {
          userId,
          flashcardId: cardId,
          quality: review.quality,
          intervalDays: review.intervalDays,
          durationMs: review.durationMs,
        },
      }),
    ]);

    if (updated.count === 0) return null;

    return this.findById(userId, cardId);
  },

  /** Estatisticas gerais do usuario, para o topo da tela de flashcards. */
  async summarize(
    userId: string,
    now: Date,
    startOfToday: Date,
    masteredIntervalDays: number,
  ): Promise<{
    totalCards: number;
    dueToday: number;
    newCards: number;
    masteredCards: number;
    reviewedToday: number;
    passedReviews: number;
    totalReviews: number;
  }> {
    const [totalCards, dueToday, newCards, masteredCards, reviewedToday, passed, totalReviews] =
      await prisma.$transaction([
        prisma.flashcard.count({ where: { userId } }),
        prisma.flashcard.count({ where: { userId, dueDate: { lte: now } } }),
        prisma.flashcard.count({ where: { userId, dueDate: null } }),
        prisma.flashcard.count({
          where: { userId, intervalDays: { gte: masteredIntervalDays } },
        }),
        prisma.flashcardReview.count({ where: { userId, reviewedAt: { gte: startOfToday } } }),
        prisma.flashcardReview.count({ where: { userId, quality: { gte: 3 } } }),
        prisma.flashcardReview.count({ where: { userId } }),
      ]);

    return {
      totalCards,
      dueToday,
      newCards,
      masteredCards,
      reviewedToday,
      passedReviews: passed,
      totalReviews,
    };
  },

  /** Datas distintas com revisao, da mais recente para a mais antiga. */
  async findReviewDays(userId: string, limit: number): Promise<Date[]> {
    const rows = await prisma.flashcardReview.findMany({
      where: { userId },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => row.reviewedAt);
  },
};
