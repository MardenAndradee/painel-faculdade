import type { CreateDeckInput, DeckListItem, DeckQuery, UpdateDeckInput } from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  deckRepository,
  type DeckCardCounts,
  type DeckRow,
} from '../repositories/deck.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { examPrepRepository } from '../repositories/exam-prep.repository.js';
import { AppError } from '../utils/app-error.js';
import { emptyToNull } from '../utils/text.js';

/** Regra de negocio de baralhos. */

/**
 * Intervalo a partir do qual um cartao conta como "dominado".
 *
 * Vinte e um dias e o ponto em que o SM-2 ja passou por pelo menos tres
 * acertos consecutivos - antes disso o cartao ainda esta em aprendizado, e
 * chama-lo de dominado daria ao aluno uma sensacao falsa de progresso.
 */
export const MASTERED_INTERVAL_DAYS = 21;

const EMPTY_COUNTS: DeckCardCounts = {
  total: 0,
  due: 0,
  new: 0,
  mastered: 0,
  lastStudiedAt: null,
};

function toListItem(row: DeckRow, counts: DeckCardCounts): DeckListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    subject: row.subject,
    totalCards: counts.total,
    dueCards: counts.due,
    newCards: counts.new,
    masteredCards: counts.mastered,
    lastStudiedAt: counts.lastStudiedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Confirma que a disciplina existe e pertence ao usuario. */
async function resolveSubjectId(
  userId: string,
  subjectId: string | undefined,
): Promise<string | null> {
  const id = emptyToNull(subjectId);

  if (id === null) return null;

  if (!(await subjectRepository.findById(userId, id))) {
    throw AppError.badRequest('Disciplina inválida');
  }

  return id;
}

export const deckService = {
  async list(userId: string, query: DeckQuery): Promise<DeckListItem[]> {
    const now = new Date();

    const [rows, counts] = await Promise.all([
      deckRepository.findMany(userId, {
        search: query.search,
        subjectId: query.subjectId,
        examPrepId: query.examPrepId,
      }),
      deckRepository.countCardsByDeck(userId, now, MASTERED_INTERVAL_DAYS),
    ]);

    return rows.map((row) => toListItem(row, counts.get(row.id) ?? EMPTY_COUNTS));
  },

  async getById(userId: string, id: string): Promise<DeckListItem> {
    const row = await deckRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Baralho');

    const counts = await deckRepository.countCardsByDeck(
      userId,
      new Date(),
      MASTERED_INTERVAL_DAYS,
    );

    return toListItem(row, counts.get(row.id) ?? EMPTY_COUNTS);
  },

  async create(userId: string, input: CreateDeckInput): Promise<DeckListItem> {
    const subjectId = await resolveSubjectId(userId, input.subjectId);

    // Baralho criado de dentro de um plano (Etapa 27) já nasce vinculado -
    // confirma que o plano existe e é do usuário antes de gravar a FK.
    if (input.examPrepId) {
      const plan = await examPrepRepository.findRefById(userId, input.examPrepId);

      if (!plan) throw AppError.badRequest('Plano de estudos inválido');
    }

    const row = await deckRepository.create(userId, {
      name: input.name,
      description: emptyToNull(input.description),
      color: input.color,
      subjectId,
      examPrepId: input.examPrepId ?? null,
    });

    return toListItem(row, EMPTY_COUNTS);
  },

  async update(userId: string, id: string, input: UpdateDeckInput): Promise<DeckListItem> {
    const data: Prisma.DeckUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.description !== undefined) data.description = emptyToNull(input.description);

    // Só recalcula o vínculo quando o campo veio no payload: um PATCH de nome
    // não pode desvincular o baralho da disciplina.
    if (input.subjectId !== undefined) {
      data.subjectId = await resolveSubjectId(userId, input.subjectId);
    }

    const row = await deckRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Baralho');

    const counts = await deckRepository.countCardsByDeck(
      userId,
      new Date(),
      MASTERED_INTERVAL_DAYS,
    );

    return toListItem(row, counts.get(row.id) ?? EMPTY_COUNTS);
  },

  /**
   * Arquiva ou desarquiva.
   *
   * Arquivar tira o baralho da fila de estudo sem apagar o progresso - util
   * para uma disciplina ja concluida que o aluno pode querer revisitar antes
   * de uma prova de final de curso.
   */
  async setArchived(userId: string, id: string, archived: boolean): Promise<DeckListItem> {
    const row = await deckRepository.update(userId, id, {
      archivedAt: archived ? new Date() : null,
    });

    if (!row) throw AppError.notFound('Baralho');

    const counts = await deckRepository.countCardsByDeck(
      userId,
      new Date(),
      MASTERED_INTERVAL_DAYS,
    );

    return toListItem(row, counts.get(row.id) ?? EMPTY_COUNTS);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await deckRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Baralho');
  },
};
