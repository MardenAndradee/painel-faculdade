import type { Request, Response } from 'express';
import { noteFolderService } from '../services/note-folder.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de pastas de anotacoes. */
export const noteFolderController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await noteFolderService.listBySubject(user.id, req.query.subjectId as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await noteFolderService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await noteFolderService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await noteFolderService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
