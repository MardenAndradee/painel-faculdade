import type { Request, Response } from 'express';
import type { CreateClassNoteInput, UpdateClassNoteInput } from '@painel/shared';
import { classNoteService } from '../services/class-note.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de anotações do Mural (Etapa 22). Sem regra de negocio. */
export const classNoteController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classNoteService.list(user.id, req.params.id as string));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classNoteService.getById(user.id, req.params.id as string, req.params.noteId as string),
    );
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(
      res,
      await classNoteService.create(
        user.id,
        req.params.id as string,
        req.body as CreateClassNoteInput,
      ),
    );
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classNoteService.update(
        user.id,
        req.params.id as string,
        req.params.noteId as string,
        req.body as UpdateClassNoteInput,
      ),
    );
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classNoteService.remove(user.id, req.params.id as string, req.params.noteId as string);
    noContent(res);
  },
};
