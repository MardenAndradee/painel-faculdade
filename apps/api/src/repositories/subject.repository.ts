import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de disciplinas. */

/** Disciplina com as notas necessarias para calcular a media (usado no dashboard). */
const withGradesSelect = {
  id: true,
  name: true,
  color: true,
  passingGrade: true,
  grades: { select: { value: true, maxValue: true, weight: true } },
} satisfies Prisma.SubjectSelect;

export type SubjectWithGrades = Prisma.SubjectGetPayload<{ select: typeof withGradesSelect }>;

/**
 * Projecao da listagem.
 *
 * As contagens vem de `_count` (subquery agregada no banco), e nao carregando
 * os registros para contar em memoria. As notas vem inteiras porque a media
 * ponderada precisa de peso e escala de cada uma.
 */
const listSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
  room: true,
  credits: true,
  passingGrade: true,
  finalGrade: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  teacher: { select: { id: true, name: true, email: true } },
  semester: { select: { id: true, name: true } },
  grades: { select: { value: true, maxValue: true, weight: true } },
  _count: { select: { assignments: true, exams: true, grades: true } },
} satisfies Prisma.SubjectSelect;

export type SubjectListRow = Prisma.SubjectGetPayload<{ select: typeof listSelect }>;

const detailSelect = {
  ...listSelect,
  description: true,
  classroomLink: true,
  googleCourseId: true,
  updatedAt: true,
} satisfies Prisma.SubjectSelect;

export type SubjectDetailRow = Prisma.SubjectGetPayload<{ select: typeof detailSelect }>;

export interface SubjectFilters {
  search?: string | undefined;
  semesterId?: string | undefined;
  status?: Prisma.SubjectWhereInput['status'];
  includeArchived: boolean;
}

/** Traduz os filtros da requisicao para a clausula WHERE do Prisma. */
function buildWhere(userId: string, filters: SubjectFilters): Prisma.SubjectWhereInput {
  const where: Prisma.SubjectWhereInput = { userId };

  if (!filters.includeArchived) {
    where.archivedAt = null;
  }

  if (filters.semesterId) {
    where.semesterId = filters.semesterId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    // Busca por nome, codigo ou nome do professor, sem diferenciar maiusculas.
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { teacher: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export const subjectRepository = {
  findActiveWithGrades(userId: string): Promise<SubjectWithGrades[]> {
    return prisma.subject.findMany({
      where: { userId, status: 'IN_PROGRESS', archivedAt: null },
      select: withGradesSelect,
      orderBy: { name: 'asc' },
    });
  },

  countActive(userId: string): Promise<number> {
    return prisma.subject.count({
      where: { userId, status: 'IN_PROGRESS', archivedAt: null },
    });
  },

  /**
   * Pagina no banco, para ordenacoes que o SQL resolve.
   *
   * A ordenacao por media NAO passa por aqui: media e derivada de `Grade` e
   * nao existe como coluna, entao o service trata esse caso a parte.
   */
  async findPaginated(
    userId: string,
    filters: SubjectFilters,
    orderBy: Prisma.SubjectOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<{ rows: SubjectListRow[]; total: number }> {
    const where = buildWhere(userId, filters);

    const [rows, total] = await prisma.$transaction([
      prisma.subject.findMany({ where, select: listSelect, orderBy, skip, take }),
      prisma.subject.count({ where }),
    ]);

    return { rows, total };
  },

  /** Todas as disciplinas que atendem ao filtro, sem paginar. */
  findAllFiltered(userId: string, filters: SubjectFilters): Promise<SubjectListRow[]> {
    return prisma.subject.findMany({
      where: buildWhere(userId, filters),
      select: listSelect,
      orderBy: { name: 'asc' },
    });
  },

  findById(userId: string, id: string): Promise<SubjectDetailRow | null> {
    // `userId` na clausula garante que ninguem acesse disciplina de outra conta.
    return prisma.subject.findFirst({
      where: { id, userId },
      select: detailSelect,
    });
  },

  create(userId: string, data: Omit<Prisma.SubjectCreateInput, 'user'>): Promise<SubjectDetailRow> {
    return prisma.subject.create({
      data: { ...data, user: { connect: { id: userId } } },
      select: detailSelect,
    });
  },

  /**
   * Atualiza a disciplina.
   *
   * Usa `SubjectUncheckedUpdateInput` (chaves estrangeiras como escalares) e
   * nao a variante com relacoes aninhadas: `updateMany` aceita apenas campos
   * escalares, e `connect`/`disconnect` fariam a query falhar em runtime.
   * A vantagem de manter `updateMany` e o filtro por dono na propria clausula,
   * garantindo que ninguem edite disciplina de outra conta.
   */
  async update(
    userId: string,
    id: string,
    data: Prisma.SubjectUncheckedUpdateInput,
  ): Promise<SubjectDetailRow | null> {
    const result = await prisma.subject.updateMany({ where: { id, userId }, data });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  /** Arquivamento: reversivel, preserva provas, notas e materiais. */
  async archive(userId: string, id: string): Promise<SubjectDetailRow | null> {
    const result = await prisma.subject.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  async restore(userId: string, id: string): Promise<SubjectDetailRow | null> {
    const result = await prisma.subject.updateMany({
      where: { id, userId },
      data: { archivedAt: null },
    });

    if (result.count === 0) return null;

    return this.findById(userId, id);
  },

  /** Exclusao permanente. O cascade do schema remove provas, notas e anexos. */
  async delete(userId: string, id: string): Promise<boolean> {
    const result = await prisma.subject.deleteMany({ where: { id, userId } });

    return result.count > 0;
  },

  /** O que seria perdido numa exclusao permanente, para confirmar na interface. */
  async countRelated(
    userId: string,
    id: string,
  ): Promise<{
    assignments: number;
    exams: number;
    grades: number;
    attachments: number;
    studySessions: number;
    calendarEvents: number;
  }> {
    const [assignments, exams, grades, attachments, studySessions, calendarEvents] =
      await prisma.$transaction([
        prisma.assignment.count({ where: { userId, subjectId: id } }),
        prisma.exam.count({ where: { userId, subjectId: id } }),
        prisma.grade.count({ where: { userId, subjectId: id } }),
        prisma.attachment.count({ where: { userId, subjectId: id } }),
        prisma.studySession.count({ where: { userId, subjectId: id } }),
        prisma.calendarEvent.count({ where: { userId, subjectId: id } }),
      ]);

    return { assignments, exams, grades, attachments, studySessions, calendarEvents };
  },

  /** Impede duas disciplinas com o mesmo nome no mesmo semestre. */
  findByNameInSemester(
    userId: string,
    name: string,
    semesterId: string | null,
    excludeId?: string,
  ): Promise<{ id: string } | null> {
    return prisma.subject.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        semesterId,
        archivedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  /** Contagens exibidas nos cards que o `_count` global nao cobre. */
  async countsByStatus(
    userId: string,
    subjectIds: string[],
  ): Promise<Map<string, { pendingAssignments: number; upcomingExams: number }>> {
    if (subjectIds.length === 0) return new Map();

    const now = new Date();

    // Duas consultas indexadas trazendo apenas `subjectId`, agrupadas em
    // memoria. O `groupBy` do Prisma tiparia `_count` como union ambiguo, e o
    // volume aqui e de dezenas de linhas por usuario - nao de milhares.
    const [pending, upcoming] = await prisma.$transaction([
      prisma.assignment.findMany({
        where: {
          userId,
          subjectId: { in: subjectIds },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        select: { subjectId: true },
      }),
      prisma.exam.findMany({
        where: { userId, subjectId: { in: subjectIds }, date: { gte: now } },
        select: { subjectId: true },
      }),
    ]);

    const map = new Map<string, { pendingAssignments: number; upcomingExams: number }>();

    for (const id of subjectIds) {
      map.set(id, { pendingAssignments: 0, upcomingExams: 0 });
    }

    for (const row of pending) {
      if (!row.subjectId) continue;
      const entry = map.get(row.subjectId);
      if (entry) entry.pendingAssignments += 1;
    }

    for (const row of upcoming) {
      const entry = map.get(row.subjectId);
      if (entry) entry.upcomingExams += 1;
    }

    return map;
  },
};
