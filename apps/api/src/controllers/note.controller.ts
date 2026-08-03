import type { Request, Response } from 'express';
import { noteService } from '../services/note.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de notas. */
export const noteController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await noteService.listBySubject(user.id, req.query.subjectId as string));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await noteService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await noteService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await noteService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await noteService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
