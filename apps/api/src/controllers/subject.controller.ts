import type { Request, Response } from 'express';
import type { SubjectQuery } from '@painel/shared';
import { subjectService } from '../services/subject.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok, paginated } from '../utils/http-response.js';

/** Camada HTTP de disciplinas. Sem regra de negocio. */
export const subjectController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    paginated(res, await subjectService.list(user.id, req.query as unknown as SubjectQuery));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await subjectService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await subjectService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await subjectService.update(user.id, req.params.id as string, req.body));
  },

  /**
   * Remove a disciplina.
   *
   * Por padrao arquiva - reversivel e sem perder notas. A exclusao definitiva
   * exige `?permanent=true`, enviado apenas apos confirmacao na interface.
   */
  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const id = req.params.id as string;
    const { permanent } = req.query as unknown as { permanent: boolean };

    if (permanent) {
      await subjectService.remove(user.id, id);
      noContent(res);
      return;
    }

    ok(res, await subjectService.archive(user.id, id));
  },

  async restore(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await subjectService.restore(user.id, req.params.id as string));
  },

  /** Quantos registros seriam perdidos numa exclusao permanente. */
  async deletionImpact(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await subjectService.getDeletionImpact(user.id, req.params.id as string));
  },
};
