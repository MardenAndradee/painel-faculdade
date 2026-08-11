import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados da central de notificacoes (Etapa 19). */

const listSelect = {
  id: true,
  type: true,
  priority: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof listSelect }>;

export interface NotificationDraft {
  type: Prisma.NotificationUncheckedCreateInput['type'];
  priority: Prisma.NotificationUncheckedCreateInput['priority'];
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
}

export const notificationRepository = {
  async findPaginated(
    userId: string,
    unreadOnly: boolean,
    skip: number,
    take: number,
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        select: listSelect,
        // Nao lidas primeiro, depois as mais recentes: o sino existe para
        // mostrar o que ainda exige acao.
        orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    return { rows, total };
  },

  countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  /**
   * Notificacoes ja existentes para um conjunto de entidades, LIDAS OU NAO.
   *
   * As nao lidas permitem atualizar em vez de duplicar: a atividade que ontem
   * "vencia amanha" hoje "vence hoje", e continua sendo a mesma linha.
   *
   * As lidas importam tanto quanto: ignora-las fazia a varredura recriar,
   * segundos depois, exatamente a notificacao que a pessoa acabara de dispensar
   * - o indicador do sino voltava sozinho para o mesmo numero.
   */
  findByEntityIds(userId: string, entityIds: string[]): Promise<NotificationRow[]> {
    if (entityIds.length === 0) return Promise.resolve([]);

    return prisma.notification.findMany({
      where: { userId, entityId: { in: entityIds } },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Nao lidas de um tipo de entidade - base da reconciliacao. */
  findUnreadByEntityType(userId: string, entityType: string): Promise<NotificationRow[]> {
    return prisma.notification.findMany({
      where: { userId, entityType, readAt: null },
      select: listSelect,
    });
  },

  create(userId: string, draft: NotificationDraft): Promise<NotificationRow> {
    return prisma.notification.create({ data: { userId, ...draft }, select: listSelect });
  },

  async update(userId: string, id: string, draft: NotificationDraft): Promise<void> {
    await prisma.notification.updateMany({ where: { id, userId }, data: draft });
  },

  async deleteMany(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await prisma.notification.deleteMany({ where: { userId, id: { in: ids } } });
  },

  async markAsRead(userId: string, id: string): Promise<NotificationRow | null> {
    const result = await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    // `count === 0` tanto para "nao existe" quanto para "ja estava lida"; o
    // service distingue relendo o registro.
    if (result.count === 0) {
      return prisma.notification.findFirst({ where: { id, userId }, select: listSelect });
    }

    return prisma.notification.findFirst({ where: { id, userId }, select: listSelect });
  },

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return result.count;
  },

  /**
   * Atividades e provas que a varredura precisa avaliar.
   *
   * As janelas sao apertadas de proposito: a varredura roda a cada abertura da
   * lista, entao carregar o historico inteiro do usuario para descartar quase
   * tudo seria desperdicio a cada clique no sino. As regras que decidem o que
   * vira notificacao vivem em `notification-rules.ts`.
   */
  async findScanSources(
    userId: string,
    window: { assignmentsFrom: Date; assignmentsTo: Date; examsFrom: Date; examsTo: Date },
  ): Promise<{
    assignments: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      subject: { name: string } | null;
    }>;
    exams: Array<{ id: string; title: string; date: Date; subject: { name: string } | null }>;
  }> {
    const [assignments, exams] = await Promise.all([
      prisma.assignment.findMany({
        // Concluida ou cancelada nao gera lembrete - o assunto acabou.
        where: {
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { gte: window.assignmentsFrom, lte: window.assignmentsTo },
        },
        select: { id: true, title: true, dueDate: true, subject: { select: { name: true } } },
      }),
      prisma.exam.findMany({
        where: { userId, date: { gte: window.examsFrom, lte: window.examsTo } },
        select: { id: true, title: true, date: true, subject: { select: { name: true } } },
      }),
    ]);

    return { assignments, exams };
  },
};
