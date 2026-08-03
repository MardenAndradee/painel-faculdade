import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de notas. */

const listSelect = {
  id: true,
  title: true,
  subjectId: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteSelect;

export type NoteListRow = Prisma.NoteGetPayload<{ select: typeof listSelect }>;

/** Projecao completa, com o documento do editor. Usada so quando a nota e aberta. */
const detailSelect = {
  ...listSelect,
  content: true,
} satisfies Prisma.NoteSelect;

export type NoteDetailRow = Prisma.NoteGetPayload<{ select: typeof detailSelect }>;

export const noteRepository = {
  findBySubject(userId: string, subjectId: string): Promise<NoteListRow[]> {
    return prisma.note.findMany({
      where: { userId, subjectId },
      select: listSelect,
      orderBy: { title: 'asc' },
    });
  },

  findById(userId: string, id: string): Promise<NoteDetailRow | null> {
    return prisma.note.findFirst({ where: { id, userId }, select: detailSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.NoteUncheckedCreateInput, 'userId'>,
  ): Promise<NoteDetailRow> {
    return prisma.note.create({ data: { ...data, userId }, select: detailSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.NoteUncheckedUpdateInput,
  ): Promise<NoteDetailRow | null> {
    const result = await prisma.note.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.note.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },
};
