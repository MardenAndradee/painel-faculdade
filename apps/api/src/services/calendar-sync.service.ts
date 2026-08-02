import type { CalendarSyncReport } from '@painel/shared';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type {
  GoogleCalendarClient,
  GoogleCalendarEvent,
  GoogleEventDateTime,
} from '../integrations/calendar/calendar.types.js';

/**
 * Importacao do Google Calendar.
 *
 * Recebe o cliente por parametro, pelo mesmo motivo do Classroom: permite
 * exercitar deduplicacao, recorrencias e remocao de cancelados sem depender de
 * uma conta Google real.
 *
 * POLITICA
 * --------
 * Eventos importados pertencem ao Google: titulo, horario e local sao sempre
 * sobrescritos. O vinculo com disciplina, feito no Painel, e PRESERVADO.
 *
 * Eventos criados no Painel (`source: MANUAL`) nunca sao tocados.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Janela importada: passado recente e proximo semestre. */
export const SYNC_WINDOW_PAST_DAYS = 30;
export const SYNC_WINDOW_FUTURE_DAYS = 180;

/**
 * Converte a data do Google em Date.
 *
 * Eventos com horario trazem `dateTime` com fuso; eventos de dia inteiro
 * trazem `date` (YYYY-MM-DD), que interpretamos no fuso local - "reuniao dia
 * 15" e o dia 15 de quem le, nao 15 em UTC.
 */
function parseEventDate(value: GoogleEventDateTime | undefined, endOfDay = false): Date | null {
  if (!value) return null;

  if (value.dateTime) {
    const parsed = new Date(value.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value.date) {
    const [year, month, day] = value.date.split('-').map(Number);

    if (!year || !month || !day) return null;

    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59)
      : new Date(year, month - 1, day, 0, 0, 0);
  }

  return null;
}

/** Evento sem horario definido ocupa o dia inteiro. */
function isAllDay(event: GoogleCalendarEvent): boolean {
  return Boolean(event.start?.date && !event.start.dateTime);
}

export const calendarSyncService = {
  /**
   * Importa os eventos da janela.
   *
   * Alem de criar e atualizar, REMOVE do banco os eventos importados que
   * sumiram do Google. Sem isso, cancelar um compromisso no Google nao teria
   * efeito aqui e o painel acumularia eventos fantasma.
   */
  async sync(userId: string, client: GoogleCalendarClient): Promise<CalendarSyncReport> {
    const startedAt = new Date();

    const from = new Date(startedAt.getTime() - SYNC_WINDOW_PAST_DAYS * MS_PER_DAY);
    const to = new Date(startedAt.getTime() + SYNC_WINDOW_FUTURE_DAYS * MS_PER_DAY);

    const report: CalendarSyncReport = {
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      durationMs: 0,
      created: 0,
      updated: 0,
      removed: 0,
      skipped: 0,
      windowFrom: from.toISOString(),
      windowTo: to.toISOString(),
    };

    const events = await client.listEvents(from, to);

    logger.info('Calendar: eventos recebidos', { userId, count: events.length });

    /** Ids vistos nesta sincronizacao; o que sobrar no banco foi apagado la. */
    const seenIds = new Set<string>();

    for (const event of events) {
      const start = parseEventDate(event.start);
      const end = parseEventDate(event.end, isAllDay(event)) ?? start;

      // Cancelados e itens sem data utilizavel nao viram evento.
      if (event.status === 'cancelled' || !start || !end) {
        report.skipped += 1;
        continue;
      }

      seenIds.add(event.id);

      const existing = await prisma.calendarEvent.findFirst({
        where: { userId, googleEventId: event.id },
      });

      const data = {
        title: event.summary?.trim() || '(sem título)',
        description: event.description?.trim() || null,
        location: event.location?.trim() || null,
        startsAt: start,
        endsAt: end,
        allDay: isAllDay(event),
        syncedAt: new Date(),
      };

      if (existing) {
        await prisma.calendarEvent.update({
          where: { id: existing.id },
          // `subjectId` fica de fora: o vinculo com disciplina e do Painel.
          data,
        });
        report.updated += 1;
      } else {
        await prisma.calendarEvent.create({
          data: {
            ...data,
            userId,
            source: 'GOOGLE_CALENDAR',
            googleEventId: event.id,
            googleCalendarId: 'primary',
          },
        });
        report.created += 1;
      }
    }

    // --- Remocao dos que sumiram do Google ---------------------------------------
    const importados = await prisma.calendarEvent.findMany({
      where: {
        userId,
        source: 'GOOGLE_CALENDAR',
        // Apenas dentro da janela consultada: fora dela nao sabemos o estado.
        startsAt: { gte: from, lte: to },
      },
      select: { id: true, googleEventId: true },
    });

    const orfaos = importados
      .filter((row) => row.googleEventId && !seenIds.has(row.googleEventId))
      .map((row) => row.id);

    if (orfaos.length > 0) {
      const deleted = await prisma.calendarEvent.deleteMany({ where: { id: { in: orfaos } } });
      report.removed = deleted.count;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { calendarSyncedAt: new Date() },
    });

    const finishedAt = new Date();
    report.finishedAt = finishedAt.toISOString();
    report.durationMs = finishedAt.getTime() - startedAt.getTime();

    logger.info('Calendar: sincronizacao concluida', {
      userId,
      created: report.created,
      updated: report.updated,
      removed: report.removed,
    });

    return report;
  },
};
