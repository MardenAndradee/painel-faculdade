import { prisma, type Prisma } from '../config/prisma.js';

/**
 * Consultas das estatisticas.
 *
 * As agregacoes por dia sao feitas em memoria, e nao com `date_trunc` no SQL.
 * A escolha e deliberada: o recorte e sempre de um unico usuario num intervalo
 * limitado (365 dias no maximo), o que da algumas centenas de linhas - volume
 * em que buscar e agrupar em JS custa menos que perder a tipagem do Prisma numa
 * query bruta. Se um dia isso virar consulta multi-usuario ou o intervalo
 * crescer para anos, a conta inverte e `date_trunc` passa a valer o custo.
 */

export interface StudyMinuteRow {
  scheduledStart: Date;
  actualMinutes: number | null;
  subjectId: string | null;
}

export interface CompletedAssignmentRow {
  completedAt: Date | null;
  dueDate: Date | null;
}

export const statisticsRepository = {
  /** Blocos concluidos no periodo, com o tempo real registrado. */
  findCompletedStudySessions(userId: string, from: Date, to: Date): Promise<StudyMinuteRow[]> {
    return prisma.studySession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        scheduledStart: { gte: from, lte: to },
      },
      select: { scheduledStart: true, actualMinutes: true, subjectId: true },
    });
  },

  /** Datas das revisoes de flashcards no periodo. */
  async findReviewDates(userId: string, from: Date, to: Date): Promise<Date[]> {
    const rows = await prisma.flashcardReview.findMany({
      where: { userId, reviewedAt: { gte: from, lte: to } },
      select: { reviewedAt: true },
    });

    return rows.map((row) => row.reviewedAt);
  },

  /** Atividades concluidas no periodo, com prazo para medir pontualidade. */
  findCompletedAssignments(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<CompletedAssignmentRow[]> {
    return prisma.assignment.findMany({
      where: { userId, status: 'COMPLETED', completedAt: { gte: from, lte: to } },
      select: { completedAt: true, dueDate: true },
    });
  },

  /** Contagem das atividades ainda abertas, separando as que ja venceram. */
  async countOpenAssignments(
    userId: string,
    now: Date,
  ): Promise<{ pending: number; overdue: number }> {
    // Sem `as const`: o Prisma exige um array mutavel em `in`.
    const open: Prisma.AssignmentWhereInput = { status: { in: ['PENDING', 'IN_PROGRESS'] } };

    const [pending, overdue] = await prisma.$transaction([
      prisma.assignment.count({
        where: { userId, ...open, OR: [{ dueDate: null }, { dueDate: { gte: now } }] },
      }),
      prisma.assignment.count({ where: { userId, ...open, dueDate: { lt: now } } }),
    ]);

    return { pending, overdue };
  },

  /** Disciplinas em andamento com as notas lancadas, para a media por materia. */
  findSubjectsWithGrades(userId: string) {
    return prisma.subject.findMany({
      where: { userId, status: 'IN_PROGRESS', archivedAt: null },
      select: {
        id: true,
        name: true,
        color: true,
        grades: {
          select: {
            value: true,
            maxValue: true,
            gradeComponent: { select: { id: true, weight: true } },
          },
        },
        gradeConfiguration: { select: { components: { select: { weight: true } } } },
      },
    });
  },

  /** Semestres com as disciplinas consolidadas, para a evolucao. */
  findSemestersWithResults(userId: string) {
    return prisma.semester.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        year: true,
        term: true,
        status: true,
        subjects: {
          select: { finalGrade: true, credits: true, status: true },
        },
      },
      orderBy: [{ year: 'asc' }, { term: 'asc' }],
    });
  },

  /** Cartoes dominados: intervalo alem do corte de aprendizado. */
  countMasteredCards(userId: string, masteredIntervalDays: number): Promise<number> {
    return prisma.flashcard.count({
      where: { userId, intervalDays: { gte: masteredIntervalDays } },
    });
  },

  /** Nomes das disciplinas, para rotular o tempo de estudo por materia. */
  findSubjectRefs(userId: string) {
    return prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
    });
  },

  /** Janelas semanais de disponibilidade declaradas, para a meta de horas. */
  findWeeklyAvailability(userId: string) {
    return prisma.studyAvailability.findMany({
      where: { userId },
      select: { startMinute: true, endMinute: true },
    });
  },
};
