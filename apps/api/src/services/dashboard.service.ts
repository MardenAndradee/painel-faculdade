import type {
  DashboardAssignment,
  DashboardExam,
  DashboardStats,
  DashboardSummary,
} from '@painel/shared';
import {
  assignmentRepository,
  type AssignmentDashboardRow,
} from '../repositories/assignment.repository.js';
import { examRepository, type ExamDashboardRow } from '../repositories/exam.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { studySessionRepository } from '../repositories/study-session.repository.js';
import { semesterService } from './semester.service.js';
import { calendarService } from './calendar.service.js';
import {
  calculateOverallAverage,
  calculateWeightedAverage,
  toGradeLikes,
  totalConfiguredWeight,
} from '../utils/grade-calculator.js';

/**
 * Agregacao do dashboard.
 *
 * Concentra os calculos que a interface nao deve refazer: medias, dias
 * restantes e taxa de conclusao. O frontend recebe numeros prontos, o que
 * mantem os componentes focados em apresentacao.
 */

const UPCOMING_LIMIT = 5;
const OVERDUE_LIMIT = 5;
const CALENDAR_WINDOW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Diferenca em dias de calendario, ignorando a hora.
 *
 * Uma entrega hoje as 23h59 precisa aparecer como "hoje" (0), e nao como
 * "amanha" por conta do arredondamento das horas restantes.
 */
function daysBetween(from: Date, to: Date): number {
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / MS_PER_DAY);
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);

  return copy;
}

function toDashboardAssignment(row: AssignmentDashboardRow, now: Date): DashboardAssignment {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate?.toISOString() ?? null,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    daysUntilDue: row.dueDate ? daysBetween(now, row.dueDate) : null,
  };
}

function toDashboardExam(row: ExamDashboardRow, now: Date): DashboardExam {
  return {
    id: row.id,
    title: row.title,
    date: row.date.toISOString(),
    room: row.room,
    subject: row.subject,
    daysUntilExam: daysBetween(now, row.date),
  };
}

export const dashboardService = {
  /**
   * Monta o resumo completo.
   *
   * As consultas independentes rodam em paralelo: o tempo total passa a ser o
   * da mais lenta, e nao a soma de todas.
   */
  async getSummary(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const todayEnd = endOfDay(now);
    const weekEnd = endOfDay(new Date(now.getTime() + 7 * MS_PER_DAY));
    const calendarEnd = endOfDay(new Date(now.getTime() + CALENDAR_WINDOW_DAYS * MS_PER_DAY));

    const [
      upcomingRows,
      overdueRows,
      examRows,
      subjects,
      counts,
      upcomingExamCount,
      studyMinutes,
      semester,
    ] = await Promise.all([
      assignmentRepository.findUpcoming(userId, UPCOMING_LIMIT),
      assignmentRepository.findOverdue(userId, OVERDUE_LIMIT),
      examRepository.findUpcoming(userId, UPCOMING_LIMIT),
      subjectRepository.findActiveWithGrades(userId),
      assignmentRepository.countByStatus(userId, todayEnd, weekEnd),
      examRepository.countUpcoming(userId),
      studySessionRepository.sumMinutes(userId, new Date(now.getTime() - 30 * MS_PER_DAY), now),
      semesterService.getOrCreateCurrent(userId),
    ]);

    // A agenda vem do calendar.service: manter a agregacao em dois lugares
    // faria o dashboard e o calendario divergirem com o tempo.
    const calendar = await calendarService.getAgenda(userId, now, calendarEnd, {
      includeCompleted: false,
    });

    const stats: DashboardStats = {
      subjectCount: subjects.length,
      overallAverage: calculateOverallAverage(
        subjects.map((subject) =>
          calculateWeightedAverage(
            toGradeLikes(subject.grades),
            totalConfiguredWeight(subject.gradeConfiguration?.components),
          ),
        ),
      ),
      pendingCount: counts.pending,
      overdueCount: counts.overdue,
      dueTodayCount: counts.dueToday,
      dueThisWeekCount: counts.dueThisWeek,
      completedCount: counts.completed,
      completionRate: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      upcomingExamCount,
      studyHoursPlanned: Number((studyMinutes.plannedMinutes / 60).toFixed(1)),
      studyHoursCompleted: Number((studyMinutes.completedMinutes / 60).toFixed(1)),
    };

    return {
      stats,
      upcomingAssignments: upcomingRows.map((row) => toDashboardAssignment(row, now)),
      overdueAssignments: overdueRows.map((row) => toDashboardAssignment(row, now)),
      upcomingExams: examRows.map((row) => toDashboardExam(row, now)),
      calendar,
      currentSemester: { id: semester.id, name: semester.name },
    };
  },
};
