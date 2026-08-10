import type { AssignmentStatus, Priority } from '../enums.js';
import type { CalendarItem } from './calendar.js';

/**
 * Contrato do resumo do dashboard.
 *
 * Uma unica resposta agrega tudo que a primeira tela precisa. Seis chamadas
 * separadas significariam seis idas ao servidor antes do usuario ver qualquer
 * coisa - inaceitavel em conexao movel.
 */

/** Disciplina reduzida ao necessario para exibir junto de uma atividade. */
export interface SubjectRef {
  id: string;
  name: string;
  color: string;
}

export interface DashboardAssignment {
  id: string;
  title: string;
  dueDate: string | null;
  priority: Priority;
  status: AssignmentStatus;
  subject: SubjectRef | null;
  /** Dias ate o prazo. Negativo quando atrasada, 0 quando vence hoje. */
  daysUntilDue: number | null;
}

export interface DashboardExam {
  id: string;
  title: string;
  date: string;
  room: string | null;
  subject: SubjectRef;
  daysUntilExam: number;
}

export interface DashboardStats {
  subjectCount: number;
  /** Media geral, ou null quando nenhuma nota foi lancada ainda. */
  overallAverage: number | null;
  pendingCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  completedCount: number;
  /** Percentual de conclusao do semestre, de 0 a 100. */
  completionRate: number;
  upcomingExamCount: number;
  studyHoursPlanned: number;
  studyHoursCompleted: number;
}

export interface DashboardSummary {
  stats: DashboardStats;
  upcomingAssignments: DashboardAssignment[];
  overdueAssignments: DashboardAssignment[];
  upcomingExams: DashboardExam[];
  /** Itens dos proximos 14 dias, no mesmo formato da agenda completa. */
  calendar: CalendarItem[];
  currentSemester: { id: string; name: string } | null;
}
