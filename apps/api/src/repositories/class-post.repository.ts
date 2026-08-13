import { prisma, type Prisma } from '../config/prisma.js';
import type { ClassPostKind } from '@painel/shared';

/** Acesso a dados de publicações de turma (Etapa 21). */

const postSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  date: true,
  durationMinutes: true,
  room: true,
  dueDate: true,
  priority: true,
  maxPoints: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  createdAt: true,
  updatedAt: true,
  classId: true,
  classSubjectId: true,
  classSubject: { select: { id: true, name: true, color: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { copies: true } },
} satisfies Prisma.ClassPostSelect;

export type ClassPostRow = Prisma.ClassPostGetPayload<{ select: typeof postSelect }>;

export interface EntityCopyRow {
  id: string;
  userId: string;
  subjectId: string | null;
  classPostId: string;
}

export const classPostRepository = {
  listByClass(classId: string): Promise<ClassPostRow[]> {
    return prisma.classPost.findMany({
      where: { classId },
      select: postSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(classId: string, id: string): Promise<ClassPostRow | null> {
    return prisma.classPost.findFirst({ where: { id, classId }, select: postSelect });
  },

  /** Publicações com data dentro do intervalo, para a Visão geral da turma. */
  findUpcoming(classId: string, from: Date, to: Date): Promise<ClassPostRow[]> {
    return prisma.classPost.findMany({
      where: {
        classId,
        OR: [
          { kind: 'EXAM', date: { gte: from, lte: to } },
          { kind: 'ASSIGNMENT', dueDate: { gte: from, lte: to } },
          { kind: 'EVENT', startsAt: { gte: from, lte: to } },
        ],
      },
      select: postSelect,
      orderBy: [{ date: 'asc' }, { dueDate: 'asc' }, { startsAt: 'asc' }],
    });
  },

  create(
    classId: string,
    createdById: string,
    data: Omit<Prisma.ClassPostUncheckedCreateInput, 'classId' | 'createdById'>,
  ): Promise<ClassPostRow> {
    return prisma.classPost.create({ data: { ...data, classId, createdById }, select: postSelect });
  },

  async update(
    classId: string,
    id: string,
    data: Prisma.ClassPostUncheckedUpdateInput,
  ): Promise<ClassPostRow | null> {
    const result = await prisma.classPost.updateMany({ where: { id, classId }, data });

    if (result.count === 0) return null;

    return this.findById(classId, id);
  },

  /**
   * Exclui o post e as cópias NÃO divergentes (a entidade real de cada uma).
   *
   * As cópias divergentes (`detachedAt` preenchido) sobrevivem: o delete do
   * `ClassPost` só as alcança via cascata do bookkeeping (`ClassPostCopy`) e
   * `SetNull` no selo (`classPostId`) das entidades - nunca apaga o dado do
   * membro que já tinha tornado aquilo seu.
   */
  async remove(classId: string, id: string): Promise<ClassPostKind | null> {
    const post = await prisma.classPost.findFirst({
      where: { id, classId },
      select: { id: true, kind: true },
    });

    if (!post) return null;

    const attachedCopies = await prisma.classPostCopy.findMany({
      where: { classPostId: id, detachedAt: null },
      select: { assignmentId: true, examId: true, calendarEventId: true },
    });

    if (attachedCopies.length > 0) {
      if (post.kind === 'ASSIGNMENT') {
        const ids = attachedCopies.map((copy) => copy.assignmentId).filter((v): v is string => !!v);
        await prisma.assignment.deleteMany({ where: { id: { in: ids } } });
      } else if (post.kind === 'EXAM') {
        const ids = attachedCopies.map((copy) => copy.examId).filter((v): v is string => !!v);
        await prisma.exam.deleteMany({ where: { id: { in: ids } } });
      } else {
        const ids = attachedCopies
          .map((copy) => copy.calendarEventId)
          .filter((v): v is string => !!v);
        await prisma.calendarEvent.deleteMany({ where: { id: { in: ids } } });
      }
    }

    await prisma.classPost.delete({ where: { id } });

    return post.kind;
  },

  // --- Cópias --------------------------------------------------------------------

  findCopy(classPostId: string, userId: string): Promise<{ id: string } | null> {
    return prisma.classPostCopy.findUnique({
      where: { classPostId_userId: { classPostId, userId } },
      select: { id: true },
    });
  },

  /** Membros com cópia divergente do post - a propagação de edição os pula. */
  async findDetachedUserIds(classPostId: string): Promise<Set<string>> {
    const rows = await prisma.classPostCopy.findMany({
      where: { classPostId, detachedAt: { not: null } },
      select: { userId: true },
    });

    return new Set(rows.map((row) => row.userId));
  },

  createCopyRecords(
    rows: Array<{
      id: string;
      classPostId: string;
      userId: string;
      assignmentId?: string;
      examId?: string;
      calendarEventId?: string;
    }>,
  ): Promise<Prisma.BatchPayload> {
    return prisma.classPostCopy.createMany({ data: rows });
  },

  /** Marca a cópia do membro como divergente - ele editou, a propagação futura o pula. */
  async markDetached(classPostId: string, userId: string): Promise<void> {
    await prisma.classPostCopy.updateMany({
      where: { classPostId, userId },
      data: { detachedAt: new Date() },
    });
  },

  // --- Fan-out das entidades, uma inserção em lote por tabela ---------------------

  createAssignmentCopies(
    rows: Array<{
      id: string;
      userId: string;
      subjectId: string | null;
      classPostId: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      priority: Prisma.AssignmentCreateManyInput['priority'];
      maxPoints: number | null;
    }>,
  ): Promise<Prisma.BatchPayload> {
    return prisma.assignment.createMany({
      data: rows.map((row) => ({ ...row, source: 'MANUAL', status: 'PENDING' })),
    });
  },

  createExamCopies(
    rows: Array<{
      id: string;
      userId: string;
      subjectId: string;
      classPostId: string;
      title: string;
      content: string | null;
      date: Date;
      durationMinutes: number | null;
      room: string | null;
    }>,
  ): Promise<Prisma.BatchPayload> {
    return prisma.exam.createMany({ data: rows });
  },

  createEventCopies(
    rows: Array<{
      id: string;
      userId: string;
      subjectId: string | null;
      classPostId: string;
      title: string;
      description: string | null;
      startsAt: Date;
      endsAt: Date;
      allDay: boolean;
    }>,
  ): Promise<Prisma.BatchPayload> {
    return prisma.calendarEvent.createMany({
      data: rows.map((row) => ({ ...row, source: 'MANUAL' })),
    });
  },

  // --- Propagação de edição: updateMany filtrado pelas cópias não divergentes -----

  updateAssignmentCopies(
    classPostId: string,
    data: Prisma.AssignmentUpdateManyMutationInput,
  ): Promise<Prisma.BatchPayload> {
    return prisma.assignment.updateMany({
      where: { classPostId, classPostCopy: { detachedAt: null } },
      data,
    });
  },

  updateExamCopies(
    classPostId: string,
    data: Prisma.ExamUpdateManyMutationInput,
  ): Promise<Prisma.BatchPayload> {
    return prisma.exam.updateMany({
      where: { classPostId, classPostCopy: { detachedAt: null } },
      data,
    });
  },

  updateEventCopies(
    classPostId: string,
    data: Prisma.CalendarEventUpdateManyMutationInput,
  ): Promise<Prisma.BatchPayload> {
    return prisma.calendarEvent.updateMany({
      where: { classPostId, classPostCopy: { detachedAt: null } },
      data,
    });
  },
};
