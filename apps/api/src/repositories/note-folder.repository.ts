import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de pastas de anotacoes. */

const listSelect = {
  id: true,
  name: true,
  subjectId: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteFolderSelect;

export type NoteFolderRow = Prisma.NoteFolderGetPayload<{ select: typeof listSelect }>;

export const noteFolderRepository = {
  findBySubject(userId: string, subjectId: string): Promise<NoteFolderRow[]> {
    return prisma.noteFolder.findMany({
      where: { userId, subjectId },
      select: listSelect,
      orderBy: { name: 'asc' },
    });
  },

  findById(userId: string, id: string): Promise<NoteFolderRow | null> {
    return prisma.noteFolder.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.NoteFolderUncheckedCreateInput, 'userId'>,
  ): Promise<NoteFolderRow> {
    return prisma.noteFolder.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.NoteFolderUncheckedUpdateInput,
  ): Promise<NoteFolderRow | null> {
    const result = await prisma.noteFolder.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.noteFolder.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },
};
