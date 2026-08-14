import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados do Plano de Estudos (Etapa 27, rótulo; nome interno `ExamPrep`). */

const detailSelect = {
  id: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  exam: {
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      subject: {
        select: {
          id: true,
          name: true,
          color: true,
          semester: { select: { id: true, name: true } },
        },
      },
    },
  },
  items: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
  materials: {
    orderBy: { addedAt: 'desc' },
    select: {
      id: true,
      addedAt: true,
      attachment: {
        select: { id: true, name: true, type: true, url: true, mimeType: true },
      },
    },
  },
  decks: {
    select: {
      _count: { select: { cards: true } },
      cards: { select: { intervalDays: true } },
    },
  },
  // Sem filtro por status: o service soma os minutos das concluídas E acha a
  // sessão em andamento (se houver), na mesma consulta.
  studySessions: {
    select: { id: true, status: true, actualMinutes: true, scheduledStart: true },
  },
} satisfies Prisma.ExamPrepSelect;

export type ExamPrepDetailRow = Prisma.ExamPrepGetPayload<{ select: typeof detailSelect }>;

/** Linha mínima usada só para checar existência (menu "criar" x "ver" e a validação de conflito). */
const refSelect = {
  id: true,
} satisfies Prisma.ExamPrepSelect;

export type ExamPrepRefRow = Prisma.ExamPrepGetPayload<{ select: typeof refSelect }>;

/** O necessário pra herdar título/disciplina ao iniciar uma sessão de estudo (Etapa 9). */
const examRefSelect = {
  id: true,
  exam: { select: { id: true, title: true, subjectId: true } },
} satisfies Prisma.ExamPrepSelect;

export type ExamPrepExamRefRow = Prisma.ExamPrepGetPayload<{ select: typeof examRefSelect }>;

export const examPrepRepository = {
  findByExamId(userId: string, examId: string): Promise<ExamPrepRefRow | null> {
    return prisma.examPrep.findFirst({ where: { userId, examId }, select: refSelect });
  },

  findExamRefById(userId: string, id: string): Promise<ExamPrepExamRefRow | null> {
    return prisma.examPrep.findFirst({ where: { id, userId }, select: examRefSelect });
  },

  /**
   * Mapa examId -> id do plano, para o gerador automático do Cronograma
   * (Etapa 10) preencher `examPrepId` de graça quando gera uma sessão a
   * partir de uma prova que já tem plano.
   */
  async mapIdsByExamIds(userId: string, examIds: string[]): Promise<Map<string, string>> {
    if (examIds.length === 0) return new Map();

    const rows = await prisma.examPrep.findMany({
      where: { userId, examId: { in: examIds } },
      select: { id: true, examId: true },
    });

    return new Map(rows.map((row) => [row.examId, row.id]));
  },

  create(userId: string, examId: string): Promise<ExamPrepRefRow> {
    return prisma.examPrep.create({ data: { userId, examId }, select: refSelect });
  },

  findDetailById(userId: string, id: string): Promise<ExamPrepDetailRow | null> {
    return prisma.examPrep.findFirst({ where: { id, userId }, select: detailSelect });
  },

  findRefById(userId: string, id: string): Promise<ExamPrepRefRow | null> {
    return prisma.examPrep.findFirst({ where: { id, userId }, select: refSelect });
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.examPrep.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  // --- Exclusao (Etapa 12) -----------------------------------------------------------

  /**
   * Contagem do que será perdido de verdade ao excluir o plano - mostrada
   * antes de confirmar. `ExamPrepMaterial` e `StudySession` não entram: a
   * primeira é só uma referência (o `Attachment` sobrevive), e a segunda vira
   * `examPrepId: null` (o minuto já contado não some das Estatísticas).
   */
  async getDeletionPreview(
    userId: string,
    id: string,
  ): Promise<{
    deckCount: number;
    cardCount: number;
    itemCount: number;
    materialCount: number;
  } | null> {
    const row = await prisma.examPrep.findFirst({
      where: { id, userId },
      select: {
        _count: { select: { items: true, materials: true } },
        decks: { select: { _count: { select: { cards: true } } } },
      },
    });

    if (!row) return null;

    return {
      deckCount: row.decks.length,
      cardCount: row.decks.reduce((total, deck) => total + deck._count.cards, 0),
      itemCount: row._count.items,
      materialCount: row._count.materials,
    };
  },

  // --- Anotacoes (Etapa 6) ----------------------------------------------------------

  async updateNotes(userId: string, id: string, notes: Prisma.InputJsonValue): Promise<boolean> {
    const result = await prisma.examPrep.updateMany({ where: { id, userId }, data: { notes } });

    return result.count > 0;
  },

  // --- Conteudos (Etapa 5) ----------------------------------------------------------

  countItems(examPrepId: string): Promise<number> {
    return prisma.examPrepItem.count({ where: { examPrepId } });
  },

  createItem(examPrepId: string, data: { title: string; order: number }) {
    return prisma.examPrepItem.create({ data: { examPrepId, ...data } });
  },

  /** Cria varios itens em sequencia, continuando a ordem a partir do que ja existe. */
  async bulkCreateItems(examPrepId: string, titles: string[]): Promise<number> {
    const startOrder = await this.countItems(examPrepId);

    const result = await prisma.examPrepItem.createMany({
      data: titles.map((title, index) => ({
        examPrepId,
        title,
        order: startOrder + index,
      })),
    });

    return result.count;
  },

  /** Escopado pelo dono do plano via relação - `ExamPrepItem` não guarda `userId` próprio. */
  async updateItem(
    userId: string,
    id: string,
    data: Prisma.ExamPrepItemUpdateInput,
  ): Promise<boolean> {
    const result = await prisma.examPrepItem.updateMany({
      where: { id, examPrep: { userId } },
      data,
    });

    return result.count > 0;
  },

  async deleteItem(userId: string, id: string): Promise<boolean> {
    const result = await prisma.examPrepItem.deleteMany({ where: { id, examPrep: { userId } } });

    return result.count > 0;
  },

  // --- Materiais (Etapa 7) -----------------------------------------------------------

  findMaterialLink(examPrepId: string, attachmentId: string): Promise<{ id: string } | null> {
    return prisma.examPrepMaterial.findUnique({
      where: { examPrepId_attachmentId: { examPrepId, attachmentId } },
      select: { id: true },
    });
  },

  addMaterial(examPrepId: string, attachmentId: string): Promise<{ id: string }> {
    return prisma.examPrepMaterial.create({
      data: { examPrepId, attachmentId },
      select: { id: true },
    });
  },

  async deleteMaterial(userId: string, materialId: string): Promise<boolean> {
    const result = await prisma.examPrepMaterial.deleteMany({
      where: { id: materialId, examPrep: { userId } },
    });

    return result.count > 0;
  },
};
