import type { Request, Response } from 'express';
import type { AssignmentQuery } from '@painel/shared';
import { assignmentService } from '../services/assignment.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok, paginated } from '../utils/http-response.js';

/** Camada HTTP de atividades. */
export const assignmentController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    paginated(res, await assignmentService.list(user.id, req.query as unknown as AssignmentQuery));
  },

  /** Contagem por recorte, usada nas abas de filtro. */
  async counts(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { subjectId } = req.query as { subjectId?: string };

    ok(res, await assignmentService.counts(user.id, subjectId));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await assignmentService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await assignmentService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await assignmentService.update(user.id, req.params.id as string, req.body));
  },

  async toggleComplete(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await assignmentService.toggleComplete(user.id, req.params.id as string));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await assignmentService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
