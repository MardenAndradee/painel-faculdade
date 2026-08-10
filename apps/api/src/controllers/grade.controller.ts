import type { Request, Response } from 'express';
import { gradeService } from '../services/grade.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de notas. */
export const gradeController = {
  /** Boletim de todas as disciplinas em andamento. */
  async overview(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { semesterId } = req.query as { semesterId?: string };

    ok(res, await gradeService.getOverview(user.id, semesterId));
  },

  /** Boletim de uma disciplina, com projeção de aprovação. */
  async subjectSummary(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await gradeService.getSubjectSummary(user.id, req.params.id as string));
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { subjectId } = req.query as { subjectId?: string };

    ok(res, await gradeService.list(user.id, subjectId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await gradeService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await gradeService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await gradeService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
