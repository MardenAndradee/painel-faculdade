import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP da central de notificacoes (Etapa 19). */
export const notificationController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await notificationService.list(user.id, req.query as never));
  },

  async unreadCount(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await notificationService.unreadCount(user.id));
  },

  async markAsRead(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await notificationService.markAsRead(user.id, req.params.id as string));
  },

  async markAllAsRead(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await notificationService.markAllAsRead(user.id));
  },
};
