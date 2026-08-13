import type { Priority } from '@painel/shared';

/**
 * Tradução dos campos de um `ClassPost` para a entidade que ele publica
 * (Etapa 21).
 *
 * Função pura: quem cria a cópia (fan-out da publicação) e quem propaga uma
 * edição (`updateMany` nas cópias não divergentes) chamam exatamente a mesma
 * tradução, para que os dois caminhos nunca produzam um resultado diferente
 * para o mesmo post - o mesmo raciocínio de `grade-template-merge`.
 */

export interface ClassPostFields {
  title: string;
  description: string | null;
  date: Date | null;
  durationMinutes: number | null;
  room: string | null;
  dueDate: Date | null;
  priority: Priority | null;
  maxPoints: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean | null;
}

export interface AssignmentEntityFields {
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: Priority;
  maxPoints: number | null;
}

export interface ExamEntityFields {
  title: string;
  content: string | null;
  date: Date;
  durationMinutes: number | null;
  room: string | null;
}

export interface EventEntityFields {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

export function toAssignmentFields(post: ClassPostFields): AssignmentEntityFields {
  return {
    title: post.title,
    description: post.description,
    dueDate: post.dueDate,
    priority: post.priority ?? 'MEDIUM',
    maxPoints: post.maxPoints,
  };
}

/** `post.date` é garantido pelo schema de criação (`kind: EXAM` sempre exige data). */
export function toExamFields(post: ClassPostFields): ExamEntityFields {
  if (!post.date) throw new Error('ClassPost do tipo EXAM sem data');

  return {
    title: post.title,
    content: post.description,
    date: post.date,
    durationMinutes: post.durationMinutes,
    room: post.room,
  };
}

/** `post.startsAt`/`endsAt` são garantidos pelo schema de criação (`kind: EVENT`). */
export function toEventFields(post: ClassPostFields): EventEntityFields {
  if (!post.startsAt || !post.endsAt) throw new Error('ClassPost do tipo EVENT sem data');

  return {
    title: post.title,
    description: post.description,
    startsAt: post.startsAt,
    endsAt: post.endsAt,
    allDay: post.allDay ?? false,
  };
}
