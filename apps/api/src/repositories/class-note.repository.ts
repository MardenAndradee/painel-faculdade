import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de anotações do Mural (Etapa 22). */

const listSelect = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ClassNoteSelect;

export type ClassNoteListRow = Prisma.ClassNoteGetPayload<{ select: typeof listSelect }>;

/** Projeção completa, com o documento do editor. Usada só quando a nota é aberta. */
const detailSelect = {
  ...listSelect,
  content: true,
} satisfies Prisma.ClassNoteSelect;

export type ClassNoteDetailRow = Prisma.ClassNoteGetPayload<{ select: typeof detailSelect }>;

export const classNoteRepository = {
  listByClass(classId: string): Promise<ClassNoteListRow[]> {
    return prisma.classNote.findMany({
      where: { classId },
      select: listSelect,
      orderBy: { updatedAt: 'desc' },
    });
  },

  findById(classId: string, id: string): Promise<ClassNoteDetailRow | null> {
    return prisma.classNote.findFirst({ where: { id, classId }, select: detailSelect });
  },

  create(
    classId: string,
    createdById: string,
    data: { title: string; content: Prisma.InputJsonValue },
  ): Promise<ClassNoteDetailRow> {
    return prisma.classNote.create({
      data: { ...data, classId, createdById },
      select: detailSelect,
    });
  },

  async update(
    classId: string,
    id: string,
    data: Prisma.ClassNoteUpdateInput,
  ): Promise<ClassNoteDetailRow | null> {
    const result = await prisma.classNote.updateMany({ where: { id, classId }, data });

    if (result.count === 0) return null;

    return this.findById(classId, id);
  },

  async remove(classId: string, id: string): Promise<boolean> {
    const result = await prisma.classNote.deleteMany({ where: { id, classId } });

    return result.count > 0;
  },
};
