import type {
  CalendarEventDetail,
  CalendarItem,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  calendarEventRepository,
  type CalendarEventRow,
} from '../repositories/calendar-event.repository.js';
import { assignmentRepository } from '../repositories/assignment.repository.js';
import { examRepository } from '../repositories/exam.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { AppError } from '../utils/app-error.js';
import { emptyToNull } from '../utils/text.js';

/**
 * Agenda unificada.
 *
 * Concentra a agregacao das fontes do calendario - antes duplicada dentro do
 * dashboard. Provas e atividades NAO sao copiadas para a tabela de eventos:
 * sao agregadas em tempo de consulta, entao editar uma prova reflete aqui na
 * hora, sem sincronizacao.
 */

function toBadge(
  classPostId: string | null,
  classPost: { class: { id: string; name: string } } | null,
): { classId: string; className: string } | null {
  return classPostId && classPost
    ? { classId: classPost.class.id, className: classPost.class.name }
    : null;
}

function toEventDetail(row: CalendarEventRow): CalendarEventDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    allDay: row.allDay,
    color: row.color,
    source: row.source,
    subject: row.subject,
    fromClass: toBadge(row.classPostId, row.classPost),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface AgendaOptions {
  includeCompleted: boolean;
}

export const calendarService = {
  /**
   * Itens da agenda no intervalo.
   *
   * As tres consultas rodam em paralelo; o resultado sai ordenado por horario
   * para que qualquer visao (dia, semana ou mes) receba a lista pronta.
   */
  async getAgenda(
    userId: string,
    from: Date,
    to: Date,
    options: AgendaOptions = { includeCompleted: true },
  ): Promise<CalendarItem[]> {
    const [events, exams, assignments] = await Promise.all([
      calendarEventRepository.findBetween(userId, from, to),
      examRepository.findBetween(userId, from, to),
      assignmentRepository.findBetween(userId, from, to, options.includeCompleted),
    ]);

    const items: CalendarItem[] = [
      ...events.map((event) => ({
        // A chave e prefixada: ids se repetem entre tabelas diferentes.
        key: `event:${event.id}`,
        id: event.id,
        kind: 'EVENT' as const,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        allDay: event.allDay,
        color: event.color ?? event.subject?.color ?? null,
        subject: event.subject,
        source: event.source,
        isCompleted: false,
        fromClass: toBadge(event.classPostId, event.classPost),
      })),

      ...exams.map((exam) => ({
        key: `exam:${exam.id}`,
        id: exam.id,
        kind: 'EXAM' as const,
        title: exam.title,
        description: null,
        location: exam.room,
        startsAt: exam.date.toISOString(),
        endsAt: exam.date.toISOString(),
        // Prova so guarda o dia (sem hora) - marcar allDay evita exibir um
        // "00:00" enganoso no calendario.
        allDay: true,
        color: exam.subject.color,
        subject: exam.subject,
        source: null,
        isCompleted: false,
        fromClass: toBadge(exam.classPostId, exam.classPost),
      })),

      ...assignments
        .filter((assignment) => assignment.dueDate !== null)
        .map((assignment) => ({
          key: `assignment:${assignment.id}`,
          id: assignment.id,
          kind: 'ASSIGNMENT' as const,
          title: assignment.title,
          description: null,
          location: null,
          startsAt: assignment.dueDate!.toISOString(),
          endsAt: assignment.dueDate!.toISOString(),
          // Prazo so guarda o dia (sem hora) - marcar allDay evita exibir um
          // "00:00" enganoso no calendario.
          allDay: true,
          color: assignment.subject?.color ?? null,
          subject: assignment.subject,
          source: null,
          isCompleted: assignment.status === 'COMPLETED',
          fromClass: toBadge(assignment.classPostId, assignment.classPost),
        })),
    ];

    return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },

  // --- CRUD de eventos proprios -------------------------------------------------

  async getEventById(userId: string, id: string): Promise<CalendarEventDetail> {
    const row = await calendarEventRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Evento');

    return toEventDetail(row);
  },

  async createEvent(userId: string, input: CreateCalendarEventInput): Promise<CalendarEventDetail> {
    if (input.subjectId) {
      const subject = await subjectRepository.findById(userId, input.subjectId);

      if (!subject) throw AppError.badRequest('Disciplina inválida');
    }

    const row = await calendarEventRepository.create(userId, {
      title: input.title,
      description: emptyToNull(input.description),
      location: emptyToNull(input.location),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay,
      color: emptyToNull(input.color),
      subjectId: input.subjectId ?? null,
      source: 'MANUAL',
    });

    return toEventDetail(row);
  },

  async updateEvent(
    userId: string,
    id: string,
    input: UpdateCalendarEventInput,
  ): Promise<CalendarEventDetail> {
    const current = await calendarEventRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Evento');

    if (input.subjectId) {
      const subject = await subjectRepository.findById(userId, input.subjectId);

      if (!subject) throw AppError.badRequest('Disciplina inválida');
    }

    // A validacao cruzada de datas nao sobrevive ao `.partial()` do schema:
    // aqui comparamos o que foi enviado contra o que ja esta salvo.
    const startsAt = input.startsAt ?? current.startsAt;
    const endsAt = input.endsAt ?? current.endsAt;

    if (endsAt < startsAt) {
      throw AppError.badRequest('O término precisa ser depois do início', {
        endsAt: ['O término precisa ser depois do início'],
      });
    }

    const data: Prisma.CalendarEventUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
      ...(input.location !== undefined ? { location: emptyToNull(input.location) } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
      ...(input.color !== undefined ? { color: emptyToNull(input.color) } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId ?? null } : {}),
    };

    const row = await calendarEventRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Evento');

    return toEventDetail(row);
  },

  async removeEvent(userId: string, id: string): Promise<void> {
    const deleted = await calendarEventRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Evento');
  },
};
