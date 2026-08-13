import type { AssignmentView } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de atividades. */

/** Projecao usada nos cards do dashboard. */
const dashboardSelect = {
  id: true,
  title: true,
  dueDate: true,
  priority: true,
  status: true,
  subject: { select: { id: true, name: true, color: true } },
  classPostId: true,
  classPost: { select: { class: { select: { id: true, name: true } } } },
} satisfies Prisma.AssignmentSelect;

// `status` vem no select para que a agenda saiba riscar entregas concluidas.

export type AssignmentDashboardRow = Prisma.AssignmentGetPayload<{
  select: typeof dashboardSelect;
}>;

/** Projecao completa da listagem de atividades. */
const listSelect = {
  id: true,
  title: true,
  description: true,
  notes: true,
  dueDate: true,
  priority: true,
  status: true,
  source: true,
  completedAt: true,
  maxPoints: true,
  classroomLink: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, color: true } },
  // Selo "Da turma" (Etapa 21) - nulo para atividades manuais/Classroom.
  classPostId: true,
  classPost: { select: { class: { select: { id: true, name: true } } } },
  _count: { select: { attachments: true } },
} satisfies Prisma.AssignmentSelect;

export type AssignmentListRow = Prisma.AssignmentGetPayload<{ select: typeof listSelect }>;

/** Status que ainda demandam acao do estudante. */
const OPEN_STATUSES: Prisma.EnumAssignmentStatusFilter = {
  in: ['PENDING', 'IN_PROGRESS'],
};

export interface AssignmentFilters {
  view: AssignmentView;
  search?: string | undefined;
  subjectId?: string | undefined;
  /** Recorta pelo selo "Da turma" (Etapa 21). */
  classId?: string | undefined;
  priority?: Prisma.AssignmentWhereInput['priority'];
  status?: Prisma.AssignmentWhereInput['status'];
  includeUndated: boolean;
}

/** Limites de tempo usados pelos recortes por data. */
export interface TimeBoundaries {
  now: Date;
  todayStart: Date;
  todayEnd: Date;
  weekEnd: Date;
}

export function buildTimeBoundaries(reference = new Date()): TimeBoundaries {
  const todayStart = new Date(reference);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(reference);
  todayEnd.setHours(23, 59, 59, 999);

  // "Esta semana" = proximos 7 dias corridos, e nao a semana do calendario:
  // o que importa e o que vence em breve, nao em qual domingo cai.
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { now: reference, todayStart, todayEnd, weekEnd };
}

/**
 * Traduz o recorte escolhido em condicoes de banco.
 *
 * Concentrar isso aqui evita que cada tela remonte a regra de "atrasada" ou
 * "vence hoje" - e chegue a definicoes diferentes.
 */
function viewConditions(view: AssignmentView, time: TimeBoundaries): Prisma.AssignmentWhereInput {
  switch (view) {
    case 'pendentes':
      return { status: OPEN_STATUSES };

    case 'concluidas':
      return { status: 'COMPLETED' };

    case 'atrasadas':
      return { status: OPEN_STATUSES, dueDate: { lt: time.now } };

    case 'hoje':
      return { status: OPEN_STATUSES, dueDate: { gte: time.todayStart, lte: time.todayEnd } };

    case 'semana':
      return { status: OPEN_STATUSES, dueDate: { gte: time.todayStart, lte: time.weekEnd } };

    case 'todas':
    default:
      return {};
  }
}

function buildWhere(
  userId: string,
  filters: AssignmentFilters,
  time: TimeBoundaries,
): Prisma.AssignmentWhereInput {
  const conditions: Prisma.AssignmentWhereInput[] = [
    { userId },
    viewConditions(filters.view, time),
  ];

  if (filters.subjectId) conditions.push({ subjectId: filters.subjectId });
  if (filters.classId) conditions.push({ classPost: { classId: filters.classId } });
  if (filters.priority) conditions.push({ priority: filters.priority });
  if (filters.status) conditions.push({ status: filters.status });

  if (filters.search) {
    conditions.push({
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { subject: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    });
  }

  // Atividades sem prazo somem dos recortes por data, salvo pedido explicito:
  // "vence hoje" nao deveria listar algo que nao vence nunca.
  const isDateView = ['atrasadas', 'hoje', 'semana'].includes(filters.view);

  if (filters.includeUndated && isDateView) {
    const [ownership, viewCondition, ...rest] = conditions;

    return {
      AND: [
        ownership ?? {},
        { OR: [viewCondition ?? {}, { dueDate: null, status: OPEN_STATUSES }] },
        ...rest,
      ],
    };
  }

  return { AND: conditions };
}

export const assignmentRepository = {
  // --- Consultas do dashboard --------------------------------------------------

  findUpcoming(userId: string, limit: number): Promise<AssignmentDashboardRow[]> {
    return prisma.assignment.findMany({
      where: { userId, status: OPEN_STATUSES, dueDate: { gte: new Date() } },
      select: dashboardSelect,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: limit,
    });
  },

  findOverdue(userId: string, limit: number): Promise<AssignmentDashboardRow[]> {
    return prisma.assignment.findMany({
      where: { userId, status: OPEN_STATUSES, dueDate: { lt: new Date() } },
      select: dashboardSelect,
      orderBy: { dueDate: 'asc' },
      take: limit,
    });
  },

  /**
   * Atividades com prazo dentro do intervalo, usadas pela agenda.
   *
   * `includeCompleted` permite ao calendario mostrar entregas ja concluidas
   * (riscadas) - util para ver o que foi feito na semana.
   */
  findBetween(
    userId: string,
    from: Date,
    to: Date,
    includeCompleted = false,
  ): Promise<AssignmentDashboardRow[]> {
    return prisma.assignment.findMany({
      where: {
        userId,
        dueDate: { gte: from, lte: to },
        ...(includeCompleted ? {} : { status: OPEN_STATUSES }),
      },
      select: dashboardSelect,
      orderBy: { dueDate: 'asc' },
    });
  },

  async countByStatus(
    userId: string,
    todayEnd: Date,
    weekEnd: Date,
  ): Promise<{
    pending: number;
    completed: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    total: number;
  }> {
    const now = new Date();

    const [pending, completed, overdue, dueToday, dueThisWeek, total] = await prisma.$transaction([
      prisma.assignment.count({ where: { userId, status: OPEN_STATUSES } }),
      prisma.assignment.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.assignment.count({
        where: { userId, status: OPEN_STATUSES, dueDate: { lt: now } },
      }),
      prisma.assignment.count({
        where: { userId, status: OPEN_STATUSES, dueDate: { gte: now, lte: todayEnd } },
      }),
      prisma.assignment.count({
        where: { userId, status: OPEN_STATUSES, dueDate: { gte: now, lte: weekEnd } },
      }),
      prisma.assignment.count({ where: { userId } }),
    ]);

    return { pending, completed, overdue, dueToday, dueThisWeek, total };
  },

  // --- CRUD ---------------------------------------------------------------------

  async findPaginated(
    userId: string,
    filters: AssignmentFilters,
    orderBy: Prisma.AssignmentOrderByWithRelationInput[],
    skip: number,
    take: number,
    time: TimeBoundaries,
  ): Promise<{ rows: AssignmentListRow[]; total: number }> {
    const where = buildWhere(userId, filters, time);

    const [rows, total] = await prisma.$transaction([
      prisma.assignment.findMany({ where, select: listSelect, orderBy, skip, take }),
      prisma.assignment.count({ where }),
    ]);

    return { rows, total };
  },

  findById(userId: string, id: string): Promise<AssignmentListRow | null> {
    return prisma.assignment.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.AssignmentUncheckedCreateInput, 'userId'>,
  ): Promise<AssignmentListRow> {
    return prisma.assignment.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.AssignmentUncheckedUpdateInput,
  ): Promise<AssignmentListRow | null> {
    // `updateMany` mantem o filtro por dono na propria clausula e aceita
    // apenas campos escalares - por isso o tipo `Unchecked`.
    const result = await prisma.assignment.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.assignment.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /** Contagem de cada recorte, exibida nas abas de filtro. */
  async countByView(
    userId: string,
    time: TimeBoundaries,
    scope: { subjectId?: string | undefined },
  ): Promise<Record<AssignmentView, number>> {
    const base: Prisma.AssignmentWhereInput = {
      userId,
      ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
    };

    const [todas, pendentes, concluidas, atrasadas, hoje, semana] = await prisma.$transaction([
      prisma.assignment.count({ where: base }),
      prisma.assignment.count({ where: { ...base, ...viewConditions('pendentes', time) } }),
      prisma.assignment.count({ where: { ...base, ...viewConditions('concluidas', time) } }),
      prisma.assignment.count({ where: { ...base, ...viewConditions('atrasadas', time) } }),
      prisma.assignment.count({ where: { ...base, ...viewConditions('hoje', time) } }),
      prisma.assignment.count({ where: { ...base, ...viewConditions('semana', time) } }),
    ]);

    return { todas, pendentes, concluidas, atrasadas, hoje, semana };
  },
};
