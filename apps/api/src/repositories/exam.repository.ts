import type { ExamView } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de provas. */

/** Projecao usada nos cards do dashboard. */
const dashboardSelect = {
  id: true,
  title: true,
  date: true,
  room: true,
  weight: true,
  subject: { select: { id: true, name: true, color: true } },
} satisfies Prisma.ExamSelect;

export type ExamDashboardRow = Prisma.ExamGetPayload<{ select: typeof dashboardSelect }>;

/**
 * Projecao completa da listagem.
 *
 * A nota vem junto: `Grade.examId` e unico, entao e uma relacao 1-1 barata de
 * carregar - e e o que transforma a lista de provas realizadas em historico.
 */
const listSelect = {
  id: true,
  title: true,
  content: true,
  notes: true,
  room: true,
  date: true,
  weight: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, color: true } },
  grade: { select: { id: true, value: true, maxValue: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.ExamSelect;

export type ExamListRow = Prisma.ExamGetPayload<{ select: typeof listSelect }>;

export interface ExamFilters {
  view: ExamView;
  search?: string | undefined;
  subjectId?: string | undefined;
}

function viewConditions(view: ExamView, now: Date): Prisma.ExamWhereInput {
  switch (view) {
    case 'proximas':
      return { date: { gte: now } };

    case 'realizadas':
      return { date: { lt: now } };

    case 'todas':
    default:
      return {};
  }
}

function buildWhere(userId: string, filters: ExamFilters, now: Date): Prisma.ExamWhereInput {
  const conditions: Prisma.ExamWhereInput[] = [{ userId }, viewConditions(filters.view, now)];

  if (filters.subjectId) conditions.push({ subjectId: filters.subjectId });

  if (filters.search) {
    conditions.push({
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
        { subject: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    });
  }

  return { AND: conditions };
}

export const examRepository = {
  // --- Consultas do dashboard ---------------------------------------------------

  findUpcoming(userId: string, limit: number): Promise<ExamDashboardRow[]> {
    return prisma.exam.findMany({
      where: { userId, date: { gte: new Date() } },
      select: dashboardSelect,
      orderBy: { date: 'asc' },
      take: limit,
    });
  },

  findBetween(userId: string, from: Date, to: Date): Promise<ExamDashboardRow[]> {
    return prisma.exam.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: dashboardSelect,
      orderBy: { date: 'asc' },
    });
  },

  countUpcoming(userId: string): Promise<number> {
    return prisma.exam.count({ where: { userId, date: { gte: new Date() } } });
  },

  // --- CRUD ------------------------------------------------------------------------

  async findPaginated(
    userId: string,
    filters: ExamFilters,
    orderBy: Prisma.ExamOrderByWithRelationInput[],
    skip: number,
    take: number,
    now: Date,
  ): Promise<{ rows: ExamListRow[]; total: number }> {
    const where = buildWhere(userId, filters, now);

    const [rows, total] = await prisma.$transaction([
      prisma.exam.findMany({ where, select: listSelect, orderBy, skip, take }),
      prisma.exam.count({ where }),
    ]);

    return { rows, total };
  },

  findById(userId: string, id: string): Promise<ExamListRow | null> {
    return prisma.exam.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.ExamUncheckedCreateInput, 'userId'>,
  ): Promise<ExamListRow> {
    return prisma.exam.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.ExamUncheckedUpdateInput,
  ): Promise<ExamListRow | null> {
    const result = await prisma.exam.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.exam.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  async countByView(
    userId: string,
    now: Date,
    scope: { subjectId?: string | undefined },
  ): Promise<Record<ExamView, number>> {
    const base: Prisma.ExamWhereInput = {
      userId,
      ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
    };

    const [todas, proximas, realizadas] = await prisma.$transaction([
      prisma.exam.count({ where: base }),
      prisma.exam.count({ where: { ...base, ...viewConditions('proximas', now) } }),
      prisma.exam.count({ where: { ...base, ...viewConditions('realizadas', now) } }),
    ]);

    return { todas, proximas, realizadas };
  },
};
