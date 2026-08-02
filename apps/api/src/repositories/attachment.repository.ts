import type { AttachmentSource, AttachmentType } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de materiais. */

/**
 * Projecao da listagem.
 *
 * `storageKey` fica de fora de proposito: e detalhe interno do armazenamento e
 * nunca deve chegar ao cliente. Quem precisa dele (exclusao e download) usa a
 * projecao `storageSelect`.
 */
const listSelect = {
  id: true,
  name: true,
  type: true,
  source: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, color: true } },
  assignment: { select: { id: true, title: true } },
  exam: { select: { id: true, title: true } },
} satisfies Prisma.AttachmentSelect;

export type AttachmentListRow = Prisma.AttachmentGetPayload<{ select: typeof listSelect }>;

/** Dados necessarios para servir ou apagar o blob. */
const storageSelect = {
  id: true,
  name: true,
  url: true,
  source: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
} satisfies Prisma.AttachmentSelect;

export type AttachmentStorageRow = Prisma.AttachmentGetPayload<{ select: typeof storageSelect }>;

export interface AttachmentFilters {
  search?: string | undefined;
  subjectId?: string | undefined;
  assignmentId?: string | undefined;
  examId?: string | undefined;
  type?: AttachmentType | undefined;
  source?: AttachmentSource | undefined;
}

function buildWhere(userId: string, filters: AttachmentFilters): Prisma.AttachmentWhereInput {
  const conditions: Prisma.AttachmentWhereInput[] = [{ userId }];

  if (filters.subjectId) conditions.push({ subjectId: filters.subjectId });
  if (filters.assignmentId) conditions.push({ assignmentId: filters.assignmentId });
  if (filters.examId) conditions.push({ examId: filters.examId });
  if (filters.type) conditions.push({ type: filters.type });
  if (filters.source) conditions.push({ source: filters.source });

  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { subject: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    });
  }

  return { AND: conditions };
}

/**
 * Dono cuja exclusao arrasta materiais junto.
 *
 * Excluir uma DISCIPLINA nao remove so os materiais presos a ela: as provas e
 * atividades da disciplina tambem caem por cascata, levando os materiais
 * delas. Por isso o escopo e um tipo fechado - quem chama diz "e uma
 * disciplina", e o repositorio sabe o alcance real disso.
 */
export type AttachmentOwnerScope =
  | { kind: 'subject'; id: string }
  | { kind: 'assignment'; id: string }
  | { kind: 'exam'; id: string };

function ownerCondition(scope: AttachmentOwnerScope): Prisma.AttachmentWhereInput {
  switch (scope.kind) {
    case 'subject':
      return {
        OR: [
          { subjectId: scope.id },
          { assignment: { subjectId: scope.id } },
          { exam: { subjectId: scope.id } },
        ],
      };

    case 'assignment':
      return { assignmentId: scope.id };

    case 'exam':
      return { examId: scope.id };
  }
}

export const attachmentRepository = {
  async findPaginated(
    userId: string,
    filters: AttachmentFilters,
    orderBy: Prisma.AttachmentOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<{ rows: AttachmentListRow[]; total: number }> {
    const where = buildWhere(userId, filters);

    const [rows, total] = await prisma.$transaction([
      prisma.attachment.findMany({ where, select: listSelect, orderBy, skip, take }),
      prisma.attachment.count({ where }),
    ]);

    return { rows, total };
  },

  findById(userId: string, id: string): Promise<AttachmentListRow | null> {
    return prisma.attachment.findFirst({ where: { id, userId }, select: listSelect });
  },

  /** Projecao com a chave de storage, restrita ao dono. */
  findForStorage(userId: string, id: string): Promise<AttachmentStorageRow | null> {
    return prisma.attachment.findFirst({ where: { id, userId }, select: storageSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.AttachmentUncheckedCreateInput, 'userId'>,
  ): Promise<AttachmentListRow> {
    return prisma.attachment.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.AttachmentUncheckedUpdateInput,
  ): Promise<AttachmentListRow | null> {
    const result = await prisma.attachment.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.attachment.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /**
   * Chaves de storage presas a uma disciplina, atividade ou prova.
   *
   * O banco apaga as linhas por cascata quando o dono some, mas os bytes no
   * disco ninguem apaga. Quem exclui o dono usa esta consulta ANTES para saber
   * o que precisa sumir do storage.
   */
  async findStorageKeysByOwner(userId: string, scope: AttachmentOwnerScope): Promise<string[]> {
    const rows = await prisma.attachment.findMany({
      where: { userId, storageKey: { not: null }, ...ownerCondition(scope) },
      select: { storageKey: true },
    });

    return rows.map((row) => row.storageKey).filter((key): key is string => key !== null);
  },

  /** Resumo do acervo: contagens por tipo e bytes ocupados. */
  async summarize(userId: string): Promise<{
    byType: { type: AttachmentType; count: number }[];
    totalBytes: number;
    totalFiles: number;
    totalLinks: number;
  }> {
    // `groupBy` do Prisma tem tipagem hostil para `_count` e obriga `orderBy`.
    // O acervo de um usuario cabe folgado em memoria, entao agrupamos aqui e
    // ficamos com um retorno tipado sem escapes.
    const [types, aggregate, totalFiles, totalLinks] = await prisma.$transaction([
      prisma.attachment.findMany({ where: { userId }, select: { type: true } }),
      prisma.attachment.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
      prisma.attachment.count({ where: { userId, storageKey: { not: null } } }),
      prisma.attachment.count({ where: { userId, storageKey: null } }),
    ]);

    const counts = new Map<AttachmentType, number>();

    for (const row of types) counts.set(row.type, (counts.get(row.type) ?? 0) + 1);

    return {
      byType: [...counts].map(([type, count]) => ({ type, count })),
      totalBytes: aggregate._sum.sizeBytes ?? 0,
      totalFiles,
      totalLinks,
    };
  },
};
