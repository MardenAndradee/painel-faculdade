import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de notas. */

const listSelect = {
  id: true,
  label: true,
  value: true,
  maxValue: true,
  isFinal: true,
  gradedAt: true,
  notes: true,
  createdAt: true,
  subject: { select: { id: true, name: true, color: true } },
  gradeComponent: { select: { id: true, name: true, weight: true } },
  exam: { select: { id: true, title: true, date: true } },
} satisfies Prisma.GradeSelect;

export type GradeRow = Prisma.GradeGetPayload<{ select: typeof listSelect }>;

export const gradeRepository = {
  findBySubject(userId: string, subjectId: string): Promise<GradeRow[]> {
    return prisma.grade.findMany({
      where: { userId, subjectId },
      select: listSelect,
      orderBy: [{ gradedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findAll(userId: string): Promise<GradeRow[]> {
    return prisma.grade.findMany({
      where: { userId },
      select: listSelect,
      orderBy: [{ gradedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findById(userId: string, id: string): Promise<GradeRow | null> {
    return prisma.grade.findFirst({ where: { id, userId }, select: listSelect });
  },

  create(
    userId: string,
    data: Omit<Prisma.GradeUncheckedCreateInput, 'userId'>,
  ): Promise<GradeRow> {
    return prisma.grade.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.GradeUncheckedUpdateInput,
  ): Promise<GradeRow | null> {
    const result = await prisma.grade.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.grade.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /**
   * Nota ja vinculada a uma prova.
   *
   * `Grade.examId` e unico: uma prova nao pode ter duas notas.
   */
  findByExam(userId: string, examId: string, excludeGradeId?: string): Promise<GradeRow | null> {
    return prisma.grade.findFirst({
      where: {
        userId,
        examId,
        ...(excludeGradeId ? { id: { not: excludeGradeId } } : {}),
      },
      select: listSelect,
    });
  },
};
