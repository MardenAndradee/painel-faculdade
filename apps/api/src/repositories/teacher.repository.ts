import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de professores. */

const listSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  notes: true,
  createdAt: true,
  _count: { select: { subjects: true } },
} satisfies Prisma.TeacherSelect;

export type TeacherRow = Prisma.TeacherGetPayload<{ select: typeof listSelect }>;

export const teacherRepository = {
  findAll(userId: string, search?: string): Promise<TeacherRow[]> {
    return prisma.teacher.findMany({
      where: {
        userId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: listSelect,
      orderBy: { name: 'asc' },
    });
  },

  findById(userId: string, id: string): Promise<TeacherRow | null> {
    return prisma.teacher.findFirst({ where: { id, userId }, select: listSelect });
  },

  /** Busca por nome exato, usada para reaproveitar professor ja cadastrado. */
  findByName(userId: string, name: string): Promise<TeacherRow | null> {
    return prisma.teacher.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select: listSelect,
    });
  },

  create(userId: string, data: Omit<Prisma.TeacherCreateInput, 'user'>): Promise<TeacherRow> {
    return prisma.teacher.create({
      data: { ...data, user: { connect: { id: userId } } },
      select: listSelect,
    });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.TeacherUpdateInput,
  ): Promise<TeacherRow | null> {
    const result = await prisma.teacher.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  /**
   * Remove o professor.
   *
   * As disciplinas continuam existindo: a relacao usa `onDelete: SetNull`,
   * entao elas apenas ficam sem professor associado.
   */
  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.teacher.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },
};
