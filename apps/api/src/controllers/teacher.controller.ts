import type { Request, Response } from 'express';
import { teacherService } from '../services/teacher.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de professores. */
export const teacherController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { search } = req.query as { search?: string };

    ok(res, await teacherService.list(user.id, search));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await teacherService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await teacherService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await teacherService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await teacherService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
