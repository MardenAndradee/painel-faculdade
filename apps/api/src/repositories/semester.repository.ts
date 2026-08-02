import { prisma, type Prisma } from '../config/prisma.js';
import type { Semester } from '../generated/prisma/client.js';

/** Acesso a dados de semestres. */

const listSelect = {
  id: true,
  name: true,
  year: true,
  term: true,
  status: true,
  isCurrent: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  _count: { select: { subjects: true } },
} satisfies Prisma.SemesterSelect;

export type SemesterRow = Prisma.SemesterGetPayload<{ select: typeof listSelect }>;

/** Disciplina com o necessario para montar o historico. */
const historySubjectSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
  credits: true,
  passingGrade: true,
  status: true,
  finalGrade: true,
  semesterId: true,
  teacher: { select: { name: true } },
  grades: { select: { value: true, maxValue: true, weight: true } },
} satisfies Prisma.SubjectSelect;

export type HistorySubjectRow = Prisma.SubjectGetPayload<{ select: typeof historySubjectSelect }>;

export const semesterRepository = {
  /**
   * Semestre exibido por padrao.
   *
   * Prefere o marcado como atual; sem marcacao, cai no mais recente ACTIVE,
   * para que o dashboard nunca fique sem contexto.
   */
  async findCurrent(userId: string): Promise<Semester | null> {
    const flagged = await prisma.semester.findFirst({ where: { userId, isCurrent: true } });

    if (flagged) return flagged;

    return prisma.semester.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ year: 'desc' }, { term: 'desc' }],
    });
  },

  /** Do mais recente para o mais antigo, como o historico e lido. */
  findAll(userId: string): Promise<SemesterRow[]> {
    return prisma.semester.findMany({
      where: { userId },
      select: listSelect,
      orderBy: [{ year: 'desc' }, { term: 'desc' }],
    });
  },

  findById(userId: string, id: string): Promise<SemesterRow | null> {
    return prisma.semester.findFirst({ where: { id, userId }, select: listSelect });
  },

  /** Impede dois semestres para o mesmo ano/periodo (`@@unique`). */
  findByYearTerm(
    userId: string,
    year: number,
    term: number,
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    return prisma.semester.findFirst({
      where: { userId, year, term, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
  },

  create(
    userId: string,
    data: Omit<Prisma.SemesterUncheckedCreateInput, 'userId'>,
  ): Promise<SemesterRow> {
    return prisma.semester.create({ data: { ...data, userId }, select: listSelect });
  },

  async update(
    userId: string,
    id: string,
    data: Prisma.SemesterUncheckedUpdateInput,
  ): Promise<SemesterRow | null> {
    const result = await prisma.semester.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  /**
   * Remove o semestre.
   *
   * As disciplinas NAO sao apagadas: a relacao usa `onDelete: SetNull`, entao
   * elas apenas deixam de pertencer a um periodo.
   */
  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.semester.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /** Apenas um semestre pode ser o atual. */
  async clearCurrentFlag(userId: string, exceptId?: string): Promise<void> {
    await prisma.semester.updateMany({
      where: { userId, isCurrent: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isCurrent: false },
    });
  },

  /** Disciplinas de um semestre, com notas, para montar o historico. */
  findSubjects(userId: string, semesterId: string | null): Promise<HistorySubjectRow[]> {
    return prisma.subject.findMany({
      where: { userId, semesterId, archivedAt: null },
      select: historySubjectSelect,
      orderBy: { name: 'asc' },
    });
  },

  /** Todas as disciplinas do usuario, para agrupar por semestre de uma vez. */
  findAllSubjects(userId: string): Promise<HistorySubjectRow[]> {
    return prisma.subject.findMany({
      where: { userId, archivedAt: null },
      select: historySubjectSelect,
      orderBy: { name: 'asc' },
    });
  },

  /** Grava a media final e a situacao de cada disciplina no encerramento. */
  async consolidateSubject(
    id: string,
    finalGrade: number | null,
    status: Prisma.SubjectUncheckedUpdateInput['status'],
  ): Promise<void> {
    await prisma.subject.update({ where: { id }, data: { finalGrade, status } });
  },
};
