import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de baralhos. */

const listSelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, color: true } },
} satisfies Prisma.DeckSelect;

export type DeckRow = Prisma.DeckGetPayload<{ select: typeof listSelect }>;

/**
 * Contagens por baralho.
 *
 * Vem numa consulta agregada separada em vez de `_count` com filtro: o Prisma
 * so aceita filtro em `_count` de relacao para condicoes simples, e aqui sao
 * quatro recortes diferentes sobre o mesmo relacionamento. Uma consulta que
 * agrupa por `deckId` resolve todos de uma vez.
 */
export interface DeckCardCounts {
  total: number;
  due: number;
  new: number;
  mastered: number;
  lastStudiedAt: Date | null;
}

export interface DeckFilters {
  search?: string | undefined;
  subjectId?: string | undefined;
}

function buildWhere(userId: string, filters: DeckFilters): Prisma.DeckWhereInput {
  const conditions: Prisma.DeckWhereInput[] = [{ userId }];

  if (filters.subjectId) conditions.push({ subjectId: filters.subjectId });

  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: conditions };
}

export const deckRepository = {
  findMany(userId: string, filters: DeckFilters): Promise<DeckRow[]> {
    return prisma.deck.findMany({
      where: buildWhere(userId, filters),
      select: listSelect,
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    });
  },

  findById(userId: string, id: string): Promise<DeckRow | null> {
    return prisma.deck.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(userId: string, data: Omit<Prisma.DeckUncheckedCreateInput, 'userId'>): Promise<DeckRow> {
    return prisma.deck.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.DeckUncheckedUpdateInput,
  ): Promise<DeckRow | null> {
    const result = await prisma.deck.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.deck.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /**
   * Contagens de todos os baralhos do usuario, em uma consulta.
   *
   * A alternativa - contar por baralho dentro de um laco - faria N+1 consultas
   * numa tela que sempre lista todos os baralhos de uma vez.
   */
  async countCardsByDeck(
    userId: string,
    now: Date,
    masteredIntervalDays: number,
  ): Promise<Map<string, DeckCardCounts>> {
    const cards = await prisma.flashcard.findMany({
      where: { userId },
      select: { deckId: true, dueDate: true, intervalDays: true, lastReviewedAt: true },
    });

    const counts = new Map<string, DeckCardCounts>();

    for (const card of cards) {
      const current = counts.get(card.deckId) ?? {
        total: 0,
        due: 0,
        new: 0,
        mastered: 0,
        lastStudiedAt: null,
      };

      current.total += 1;

      if (card.dueDate === null) {
        current.new += 1;
        current.due += 1;
      } else if (card.dueDate <= now) {
        current.due += 1;
      }

      if (card.intervalDays >= masteredIntervalDays) current.mastered += 1;

      if (
        card.lastReviewedAt !== null &&
        (current.lastStudiedAt === null || card.lastReviewedAt > current.lastStudiedAt)
      ) {
        current.lastStudiedAt = card.lastReviewedAt;
      }

      counts.set(card.deckId, current);
    }

    return counts;
  },
};
