import type {
  NotificationEntityType,
  NotificationPriority,
  NotificationType,
} from '@painel/shared';

/**
 * Regras que decidem o que vira notificacao (Etapa 19).
 *
 * Funcao pura, com o "agora" injetado - como `spaced-repetition` e
 * `schedule-generator`. Sem isso, testar "vence amanha" exigiria mexer no
 * relogio da maquina, e a regra so seria exercitada esperando o dia virar.
 *
 * A varredura roda sob demanda, na propria listagem: o projeto nao tem worker
 * nem fila, e um cron seria infraestrutura nova para um calculo de
 * milissegundos.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Diferenca em dias de CALENDARIO, ignorando a hora. */
export function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export interface AssignmentSource {
  id: string;
  title: string;
  dueDate: Date | null;
  subjectName: string | null;
}

export interface ExamSource {
  id: string;
  title: string;
  date: Date;
  subjectName: string | null;
}

/** Uma notificacao que a varredura entende que DEVE existir agora. */
export interface NotificationPlan {
  entityType: NotificationEntityType;
  entityId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
}

/**
 * Ate quando cada fonte interessa.
 *
 * Atividade atrasada continua cobrando por 30 dias - depois disso o lembrete
 * virou ruido, e quem nao entregou ja sabe. Prova entra no radar uma semana
 * antes, o suficiente para comecar a estudar.
 */
export const SCAN_WINDOW = {
  overdueAssignmentDays: 30,
  upcomingAssignmentDays: 3,
  upcomingExamDays: 7,
};

/** Tipos que a varredura administra - ver `reconcile` no service. */
export const SCANNED_TYPES: NotificationType[] = [
  'ASSIGNMENT_DUE',
  'ASSIGNMENT_OVERDUE',
  'EXAM_UPCOMING',
];

function withSubject(text: string, subjectName: string | null): string {
  return subjectName ? `${text} · ${subjectName}` : text;
}

/** `null` quando a atividade nao merece notificacao agora. */
export function planForAssignment(
  assignment: AssignmentSource,
  now: Date,
): NotificationPlan | null {
  if (!assignment.dueDate) return null;

  const days = daysBetween(now, assignment.dueDate);

  const base = {
    entityType: 'ASSIGNMENT' as const,
    entityId: assignment.id,
    title: assignment.title,
  };

  if (days < 0) {
    if (-days > SCAN_WINDOW.overdueAssignmentDays) return null;

    return {
      ...base,
      type: 'ASSIGNMENT_OVERDUE',
      priority: 'URGENT',
      message: withSubject(
        days === -1 ? 'Atrasada há 1 dia' : `Atrasada há ${-days} dias`,
        assignment.subjectName,
      ),
    };
  }

  if (days === 0) {
    return {
      ...base,
      type: 'ASSIGNMENT_DUE',
      priority: 'URGENT',
      message: withSubject('Entrega hoje', assignment.subjectName),
    };
  }

  if (days === 1) {
    return {
      ...base,
      type: 'ASSIGNMENT_DUE',
      priority: 'ATTENTION',
      message: withSubject('Entrega amanhã', assignment.subjectName),
    };
  }

  if (days <= SCAN_WINDOW.upcomingAssignmentDays) {
    return {
      ...base,
      type: 'ASSIGNMENT_DUE',
      priority: 'INFO',
      message: withSubject(`Entrega em ${days} dias`, assignment.subjectName),
    };
  }

  return null;
}

/** `null` quando a prova ja passou ou ainda esta longe demais. */
export function planForExam(exam: ExamSource, now: Date): NotificationPlan | null {
  const days = daysBetween(now, exam.date);

  // Prova que ja aconteceu nao e lembrete; o que resta dela e a nota.
  if (days < 0 || days > SCAN_WINDOW.upcomingExamDays) return null;

  const base = {
    entityType: 'EXAM' as const,
    entityId: exam.id,
    type: 'EXAM_UPCOMING' as const,
    title: exam.subjectName ? `Prova de ${exam.subjectName}` : exam.title,
  };

  if (days === 0) {
    return { ...base, priority: 'URGENT', message: 'É hoje' };
  }

  if (days === 1) {
    return { ...base, priority: 'URGENT', message: 'É amanhã' };
  }

  if (days <= 3) {
    return { ...base, priority: 'ATTENTION', message: `Em ${days} dias` };
  }

  return { ...base, priority: 'INFO', message: `Em ${days} dias` };
}

/** Tudo o que deve existir agora, a partir das fontes carregadas. */
export function planNotifications(
  sources: { assignments: AssignmentSource[]; exams: ExamSource[] },
  now: Date,
): NotificationPlan[] {
  const plans: NotificationPlan[] = [];

  for (const assignment of sources.assignments) {
    const plan = planForAssignment(assignment, now);

    if (plan) plans.push(plan);
  }

  for (const exam of sources.exams) {
    const plan = planForExam(exam, now);

    if (plan) plans.push(plan);
  }

  return plans;
}
