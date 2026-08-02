import type { Request, Response } from 'express';
import type { StudyPlanRangeQuery } from '@painel/shared';
import { studyPlanService } from '../services/study-plan.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { AppError } from '../utils/app-error.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP do cronograma. */

/** Converte a data da query, recusando o que o `Date` nao entende. */
function parseDate(value: string, field: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) throw AppError.badRequest(`Data inválida em "${field}"`);

  return parsed;
}

export const studyPlanController = {
  async getAvailability(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.getAvailability(user.id));
  },

  async saveAvailability(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.saveAvailability(user.id, req.body));
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { from, to } = req.query as unknown as StudyPlanRangeQuery;

    ok(res, await studyPlanService.list(user.id, parseDate(from, 'from'), parseDate(to, 'to')));
  },

  async summary(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.summary(user.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await studyPlanService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.update(user.id, req.params.id as string, req.body));
  },

  async complete(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.complete(user.id, req.params.id as string, req.body));
  },

  async skip(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.skip(user.id, req.params.id as string));
  },

  async reopen(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.reopen(user.id, req.params.id as string));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await studyPlanService.remove(user.id, req.params.id as string);
    noContent(res);
  },

  async generate(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await studyPlanService.generate(user.id, req.body));
  },
};
