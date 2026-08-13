import type { Request, Response } from 'express';
import type { CreateClassPostInput, UpdateClassPostInput } from '@painel/shared';
import { classPostService } from '../services/class-post.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de publicações de turma (Etapa 21). Sem regra de negocio. */
export const classPostController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classPostService.list(user.id, req.params.id as string));
  },

  async upcoming(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { days } = req.query as unknown as { days: number };

    ok(res, await classPostService.upcoming(user.id, req.params.id as string, days));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classPostService.getById(user.id, req.params.id as string, req.params.postId as string),
    );
  },

  async publish(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(
      res,
      await classPostService.publish(
        user.id,
        req.params.id as string,
        req.body as CreateClassPostInput,
      ),
    );
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classPostService.update(
        user.id,
        req.params.id as string,
        req.params.postId as string,
        req.body as UpdateClassPostInput,
      ),
    );
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classPostService.remove(user.id, req.params.id as string, req.params.postId as string);
    noContent(res);
  },
};
