import type { Request, Response } from 'express';
import type { ExamQuery } from '@painel/shared';
import { examService } from '../services/exam.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok, paginated } from '../utils/http-response.js';

/** Camada HTTP de provas. */
export const examController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    paginated(res, await examService.list(user.id, req.query as unknown as ExamQuery));
  },

  async counts(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { subjectId } = req.query as { subjectId?: string };

    ok(res, await examService.counts(user.id, subjectId));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await examService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await examService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await examService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
