import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados dos eventos proprios da agenda. */

const detailSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  color: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, color: true } },
  // Selo "Da turma" (Etapa 21) - nulo para eventos manuais/Google Calendar.
  classPostId: true,
  classPost: { select: { class: { select: { id: true, name: true } } } },
} satisfies Prisma.CalendarEventSelect;

export type CalendarEventRow = Prisma.CalendarEventGetPayload<{ select: typeof detailSelect }>;

export const calendarEventRepository = {
  /**
   * Eventos que intersectam o intervalo.
   *
   * A condicao nao e "comeca dentro do intervalo": um evento de varios dias
   * iniciado antes do periodo ainda deve aparecer enquanto estiver em curso.
   */
  findBetween(userId: string, from: Date, to: Date): Promise<CalendarEventRow[]> {
    return prisma.calendarEvent.findMany({
      where: { userId, startsAt: { lte: to }, endsAt: { gte: from } },
      select: detailSelect,
      orderBy: { startsAt: 'asc' },
    });
  },

  findById(userId: string, id: string): Promise<CalendarEventRow | null> {
    return prisma.calendarEvent.findFirst({ where: { id, userId }, select: detailSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.CalendarEventUncheckedCreateInput, 'userId'>,
  ): Promise<CalendarEventRow> {
    return prisma.calendarEvent.create({ data: { ...data, userId }, select: detailSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.CalendarEventUncheckedUpdateInput,
  ): Promise<CalendarEventRow | null> {
    const result = await prisma.calendarEvent.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.calendarEvent.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },
};
