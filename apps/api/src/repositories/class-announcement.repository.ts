import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de avisos do Mural (Etapa 22). */

const announcementSelect = {
  id: true,
  title: true,
  content: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ClassAnnouncementSelect;

export type ClassAnnouncementRow = Prisma.ClassAnnouncementGetPayload<{
  select: typeof announcementSelect;
}>;

export const classAnnouncementRepository = {
  /** Fixado primeiro, depois mais recente - a única ordenação que o Mural precisa. */
  listByClass(classId: string): Promise<ClassAnnouncementRow[]> {
    return prisma.classAnnouncement.findMany({
      where: { classId },
      select: announcementSelect,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findById(classId: string, id: string): Promise<ClassAnnouncementRow | null> {
    return prisma.classAnnouncement.findFirst({
      where: { id, classId },
      select: announcementSelect,
    });
  },

  create(
    classId: string,
    createdById: string,
    data: { title: string; content: string; pinned: boolean },
  ): Promise<ClassAnnouncementRow> {
    return prisma.classAnnouncement.create({
      data: { ...data, classId, createdById },
      select: announcementSelect,
    });
  },

  async update(
    classId: string,
    id: string,
    data: Prisma.ClassAnnouncementUpdateInput,
  ): Promise<ClassAnnouncementRow | null> {
    const result = await prisma.classAnnouncement.updateMany({ where: { id, classId }, data });

    if (result.count === 0) return null;

    return this.findById(classId, id);
  },

  async remove(classId: string, id: string): Promise<boolean> {
    const result = await prisma.classAnnouncement.deleteMany({ where: { id, classId } });

    return result.count > 0;
  },
};
