import type { Request, Response } from 'express';
import type { CalendarRangeQuery } from '@painel/shared';
import { calendarService } from '../services/calendar.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';
import { AppError } from '../utils/app-error.js';

/** Camada HTTP do calendario. */
export const calendarController = {
  /** Itens da agenda no intervalo pedido. */
  async agenda(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { from, to, includeCompleted } = req.query as unknown as CalendarRangeQuery;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw AppError.badRequest('Intervalo inválido');
    }

    if (toDate < fromDate) {
      throw AppError.badRequest('O fim do intervalo precisa ser depois do início');
    }

    // Intervalos muito largos trariam meses de dados de uma vez; o calendario
    // nunca precisa de mais que alguns meses por consulta.
    const MAX_RANGE_DAYS = 400;
    const days = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);

    if (days > MAX_RANGE_DAYS) {
      throw AppError.badRequest(`O intervalo não pode passar de ${MAX_RANGE_DAYS} dias`);
    }

    ok(res, await calendarService.getAgenda(user.id, fromDate, toDate, { includeCompleted }));
  },

  async getEvent(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await calendarService.getEventById(user.id, req.params.id as string));
  },

  async createEvent(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await calendarService.createEvent(user.id, req.body));
  },

  async updateEvent(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await calendarService.updateEvent(user.id, req.params.id as string, req.body));
  },

  async removeEvent(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await calendarService.removeEvent(user.id, req.params.id as string);
    noContent(res);
  },
};
