import { SEARCH_LIMIT_PER_KIND } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/**
 * Acesso a dados da busca global (Etapa 19).
 *
 * Repositorio proprio em vez de reaproveitar os cinco repositorios de
 * listagem: a paleta precisa de uma projecao unica e minima (titulo, contexto,
 * cor), nao de cinco formatos diferentes de item de lista com contagens,
 * paginacao e relacoes que ela nunca exibe. Trazer isso tudo para descartar 90%
 * seria trabalho de banco jogado fora a cada tecla digitada.
 *
 * As cinco consultas rodam em paralelo - mesmo padrao do `dashboard.service`.
 */

const contains = (term: string): Prisma.StringFilter => ({ contains: term, mode: 'insensitive' });

const subjectRef = { select: { id: true, name: true, color: true } };

export type SubjectHit = Prisma.SubjectGetPayload<{
  select: { id: true; name: true; code: true; color: true };
}>;

export type AssignmentHit = Prisma.AssignmentGetPayload<{
  select: {
    id: true;
    title: true;
    dueDate: true;
    status: true;
    subject: typeof subjectRef;
  };
}>;

export type ExamHit = Prisma.ExamGetPayload<{
  select: { id: true; title: true; date: true; subject: typeof subjectRef };
}>;

export type CalendarEventHit = Prisma.CalendarEventGetPayload<{
  select: {
    id: true;
    title: true;
    startsAt: true;
    location: true;
    subject: typeof subjectRef;
  };
}>;

export type AttachmentHit = Prisma.AttachmentGetPayload<{
  select: { id: true; name: true; type: true; subject: typeof subjectRef };
}>;

export interface SearchHits {
  subjects: SubjectHit[];
  assignments: AssignmentHit[];
  exams: ExamHit[];
  calendarEvents: CalendarEventHit[];
  attachments: AttachmentHit[];
}

export const searchRepository = {
  async findAll(userId: string, term: string): Promise<SearchHits> {
    const take = SEARCH_LIMIT_PER_KIND;

    const [subjects, assignments, exams, calendarEvents, attachments] = await Promise.all([
      prisma.subject.findMany({
        // Arquivadas ficam de fora: quem arquivou tirou da frente de proposito.
        where: {
          userId,
          archivedAt: null,
          OR: [{ name: contains(term) }, { code: contains(term) }],
        },
        select: { id: true, name: true, code: true, color: true },
        orderBy: { name: 'asc' },
        take,
      }),

      prisma.assignment.findMany({
        where: {
          userId,
          OR: [{ title: contains(term) }, { description: contains(term) }],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          subject: subjectRef,
        },
        // Pendentes com prazo mais proximo primeiro; sem prazo, no fim.
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
        take,
      }),

      prisma.exam.findMany({
        where: {
          userId,
          OR: [
            { title: contains(term) },
            { content: contains(term) },
            { subject: { name: contains(term) } },
          ],
        },
        select: { id: true, title: true, date: true, subject: subjectRef },
        orderBy: { date: 'asc' },
        take,
      }),

      prisma.calendarEvent.findMany({
        where: {
          userId,
          OR: [
            { title: contains(term) },
            { description: contains(term) },
            { location: contains(term) },
          ],
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          location: true,
          subject: subjectRef,
        },
        orderBy: { startsAt: 'asc' },
        take,
      }),

      prisma.attachment.findMany({
        where: { userId, name: contains(term) },
        select: { id: true, name: true, type: true, subject: subjectRef },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    return { subjects, assignments, exams, calendarEvents, attachments };
  },
};
