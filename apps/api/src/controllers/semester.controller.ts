import type { Request, Response } from 'express';
import { semesterService } from '../services/semester.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de semestres e historico. */
export const semesterController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.list(user.id));
  },

  /** Historico academico completo, agrupado por semestre. */
  async history(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.getHistory(user.id));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await semesterService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await semesterService.remove(user.id, req.params.id as string);
    noContent(res);
  },

  /** Prévia do encerramento: o que será consolidado. */
  async previewClose(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.previewClose(user.id, req.params.id as string));
  },

  async close(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.close(user.id, req.params.id as string));
  },

  async reopen(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await semesterService.reopen(user.id, req.params.id as string));
  },
};
