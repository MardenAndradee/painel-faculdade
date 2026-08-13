import type { Request, Response } from 'express';
import type { CreateClassAnnouncementInput, UpdateClassAnnouncementInput } from '@painel/shared';
import { classAnnouncementService } from '../services/class-announcement.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de avisos do Mural (Etapa 22). Sem regra de negocio. */
export const classAnnouncementController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classAnnouncementService.list(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(
      res,
      await classAnnouncementService.create(
        user.id,
        req.params.id as string,
        req.body as CreateClassAnnouncementInput,
      ),
    );
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classAnnouncementService.update(
        user.id,
        req.params.id as string,
        req.params.announcementId as string,
        req.body as UpdateClassAnnouncementInput,
      ),
    );
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classAnnouncementService.remove(
      user.id,
      req.params.id as string,
      req.params.announcementId as string,
    );
    noContent(res);
  },
};
