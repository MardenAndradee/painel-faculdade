import type {
  AssignmentBreakdown,
  CategoryValue,
  StatisticsQuery,
  StatisticsResponse,
  TimePoint,
} from '@painel/shared';
import { statisticsRepository } from '../repositories/statistics.repository.js';
import {
  calculateOverallAverage,
  calculateWeightedAverage,
  roundGrade,
  toGradeLikes,
  totalConfiguredWeight,
} from '../utils/grade-calculator.js';
import { MS_PER_DAY, dayKey, startOfDay, startOfWeek } from '../utils/date.js';
import { MASTERED_INTERVAL_DAYS } from './deck.service.js';

/** Regra de negocio das estatisticas. */

/**
 * Serie diaria com TODOS os dias do intervalo, inclusive os zerados.
 *
 * Omitir os dias sem dado faria o grafico de linha ligar 10 de janeiro
 * diretamente a 25 de janeiro, desenhando uma inclinacao suave onde na verdade
 * houve duas semanas sem estudar. Os zeros sao a informacao.
 */
function buildDailySeries(
  entries: { date: Date; value: number }[],
  from: Date,
  to: Date,
): TimePoint[] {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const key = dayKey(entry.date);
    totals.set(key, (totals.get(key) ?? 0) + entry.value);
  }

  const series: TimePoint[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);

  while (cursor <= end) {
    const key = dayKey(cursor);
    series.push({ date: key, value: totals.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

/** Serie semanal, com as semanas vazias preservadas pelo mesmo motivo. */
function buildWeeklySeries(dates: Date[], from: Date, to: Date): TimePoint[] {
  const totals = new Map<string, number>();

  for (const date of dates) {
    const key = dayKey(startOfWeek(date));
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const series: TimePoint[] = [];
  const cursor = startOfWeek(from);
  const end = startOfWeek(to);

  while (cursor <= end) {
    const key = dayKey(cursor);
    series.push({ date: key, value: totals.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  return series;
}

/**
 * Sequencia de dias seguidos com alguma atividade de estudo.
 *
 * Conta blocos concluidos E revisoes de flashcards: quem so revisou cartoes
 * hoje estudou, e zerar a sequencia por isso seria punir o formato de estudo.
 */
function calculateStreak(days: Set<string>, now: Date): number {
  if (days.size === 0) return 0;

  const cursor = startOfDay(now);

  // Ainda nao estudou hoje? A sequencia so quebra quando ontem tambem falha -
  // do contrario ela zeraria a 00h01 para quem estuda a noite.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export const statisticsService = {
  async getStatistics(userId: string, query: StatisticsQuery): Promise<StatisticsResponse> {
    const now = new Date();
    const days = Number(query.period);
    const from = startOfDay(new Date(now.getTime() - (days - 1) * MS_PER_DAY));

    const [
      studySessions,
      reviewDates,
      completedAssignments,
      openAssignments,
      subjects,
      semesters,
      masteredCards,
      subjectRefs,
    ] = await Promise.all([
      statisticsRepository.findCompletedStudySessions(userId, from, now),
      statisticsRepository.findReviewDates(userId, from, now),
      statisticsRepository.findCompletedAssignments(userId, from, now),
      statisticsRepository.countOpenAssignments(userId, now),
      statisticsRepository.findSubjectsWithGrades(userId),
      statisticsRepository.findSemestersWithResults(userId),
      statisticsRepository.countMasteredCards(userId, MASTERED_INTERVAL_DAYS),
      statisticsRepository.findSubjectRefs(userId),
    ]);

    // --- Series temporais ------------------------------------------------------
    const studyMinutesByDay = buildDailySeries(
      studySessions.map((session) => ({
        date: session.scheduledStart,
        value: session.actualMinutes ?? 0,
      })),
      from,
      now,
    );

    const reviewsByDay = buildDailySeries(
      reviewDates.map((date) => ({ date, value: 1 })),
      from,
      now,
    );

    const completedByWeek = buildWeeklySeries(
      completedAssignments
        .map((assignment) => assignment.completedAt)
        .filter((date): date is Date => date !== null),
      from,
      now,
    );

    // --- Comparacoes por categoria ------------------------------------------------
    const subjectAverages = subjects.map((subject) => ({
      subject,
      average: calculateWeightedAverage(
        toGradeLikes(subject.grades),
        totalConfiguredWeight(subject.gradeConfiguration?.components),
      ),
    }));

    const averageBySubject: CategoryValue[] = subjectAverages
      .filter(
        (item): item is { subject: (typeof subjects)[number]; average: number } =>
          item.average !== null,
      )
      .map((item) => ({
        id: item.subject.id,
        label: item.subject.name,
        value: item.average,
        color: item.subject.color,
      }))
      .sort((a, b) => b.value - a.value);

    const subjectNames = new Map(subjectRefs.map((subject) => [subject.id, subject]));
    const minutesBySubject = new Map<string, number>();

    for (const session of studySessions) {
      const key = session.subjectId ?? 'sem-disciplina';
      minutesBySubject.set(key, (minutesBySubject.get(key) ?? 0) + (session.actualMinutes ?? 0));
    }

    const studyMinutesBySubject: CategoryValue[] = [...minutesBySubject]
      .filter(([, minutes]) => minutes > 0)
      .map(([id, minutes]) => {
        const subject = subjectNames.get(id);

        return {
          id,
          label: subject?.name ?? 'Sem disciplina',
          value: minutes,
          ...(subject ? { color: subject.color } : {}),
        };
      })
      .sort((a, b) => b.value - a.value);

    // --- Evolucao por semestre -------------------------------------------------------
    const averageBySemester = semesters.map((semester) => {
      const consolidated = semester.subjects.filter(
        (subject): subject is typeof subject & { finalGrade: number } =>
          subject.finalGrade !== null,
      );

      const average =
        consolidated.length === 0
          ? null
          : roundGrade(
              consolidated.reduce((sum, subject) => sum + subject.finalGrade, 0) /
                consolidated.length,
            );

      // O CR usa a mesma regra do Histórico: ponderado por créditos, só
      // aprovadas. Repetir o número com outra fórmula seria contradizer a
      // outra tela.
      const approved = consolidated.filter((subject) => subject.status === 'APPROVED');
      const credits = approved.reduce((sum, subject) => sum + (subject.credits ?? 0), 0);

      const cr =
        credits === 0
          ? null
          : roundGrade(
              approved.reduce(
                (sum, subject) => sum + subject.finalGrade * (subject.credits ?? 0),
                0,
              ) / credits,
            );

      return { id: semester.id, label: semester.name, average, cr };
    });

    // --- Destaques ---------------------------------------------------------------------
    const onTime = completedAssignments.filter(
      (assignment) =>
        assignment.dueDate === null ||
        (assignment.completedAt !== null && assignment.completedAt <= assignment.dueDate),
    ).length;

    const late = completedAssignments.length - onTime;

    const assignmentBreakdown: AssignmentBreakdown = {
      completedOnTime: onTime,
      completedLate: late,
      pending: openAssignments.pending,
      overdue: openAssignments.overdue,
    };

    const studiedMinutes = studySessions.reduce(
      (total, session) => total + (session.actualMinutes ?? 0),
      0,
    );

    const activeDays = new Set<string>([
      ...studySessions
        .filter((session) => (session.actualMinutes ?? 0) > 0)
        .map((session) => dayKey(session.scheduledStart)),
      ...reviewDates.map((date) => dayKey(date)),
    ]);

    // O CR geral vem do semestre encerrado mais recente que tenha um.
    const latestCr = [...averageBySemester].reverse().find((item) => item.cr !== null)?.cr ?? null;

    return {
      period: query.period,
      from: from.toISOString(),
      to: now.toISOString(),
      highlights: {
        currentAverage: calculateOverallAverage(
          subjectAverages
            .map((item) => item.average)
            .filter((value): value is number => value !== null),
        ),
        overallCr: latestCr,
        completedAssignments: completedAssignments.length,
        onTimeRate:
          completedAssignments.length === 0
            ? null
            : Math.round((onTime / completedAssignments.length) * 100),
        studiedMinutes,
        flashcardReviews: reviewDates.length,
        masteredCards,
        streakDays: calculateStreak(activeDays, now),
      },
      averageBySubject,
      averageBySemester,
      studyMinutesByDay,
      reviewsByDay,
      completedByWeek,
      assignmentBreakdown,
      studyMinutesBySubject,
    };
  },
};
