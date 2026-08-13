import type { Request, Response } from 'express';
import type {
  ClassSubjectInput,
  CreateClassInput,
  TransferClassOwnerInput,
  UpdateClassInput,
} from '@painel/shared';
import { classService } from '../services/class.service.js';
import { classMembershipService } from '../services/class-membership.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de turmas (Etapa 20). Sem regra de negocio. */
export const classController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.list(user.id));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await classService.create(user.id, req.body as CreateClassInput));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classService.update(user.id, req.params.id as string, req.body as UpdateClassInput),
    );
  },

  async listMembers(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.listMembers(user.id, req.params.id as string));
  },

  async leave(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classService.leave(user.id, req.params.id as string);
    noContent(res);
  },

  async addSubject(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(
      res,
      await classService.addSubject(
        user.id,
        req.params.id as string,
        req.body as ClassSubjectInput,
      ),
    );
  },

  async updateSubject(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await classService.updateSubject(
        user.id,
        req.params.id as string,
        req.params.subjectId as string,
        req.body as Partial<ClassSubjectInput>,
      ),
    );
  },

  async removeSubject(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classService.removeSubject(
      user.id,
      req.params.id as string,
      req.params.subjectId as string,
    );
    noContent(res);
  },

  async createInvite(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await classService.createInvite(user.id, req.params.id as string, req.body));
  },

  async listInvites(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.listInvites(user.id, req.params.id as string));
  },

  async revokeInvite(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classService.revokeInvite(
      user.id,
      req.params.id as string,
      req.params.inviteId as string,
    );
    noContent(res);
  },

  async previewInvite(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.previewInvite(user.id, req.params.token as string));
  },

  async join(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await classMembershipService.join(user.id, req.params.token as string));
  },

  async transferOwner(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { newOwnerUserId } = req.body as TransferClassOwnerInput;

    await classService.transferOwner(user.id, req.params.id as string, newOwnerUserId);
    noContent(res);
  },

  async archive(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classService.archive(user.id, req.params.id as string);
    noContent(res);
  },

  async unarchive(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await classService.unarchive(user.id, req.params.id as string);
    noContent(res);
  },

  async health(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classService.health(user.id, req.params.id as string));
  },
};
