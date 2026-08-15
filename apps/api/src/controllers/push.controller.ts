import type { Request, Response } from 'express';
import type { SubscribePushInput, UnsubscribePushInput } from '@painel/shared';
import { pushService } from '../services/push.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de Push Notifications (Etapa 28.11). */
export const pushController = {
  async subscribe(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const body = req.body as SubscribePushInput;

    await pushService.subscribe(user.id, body, req.headers['user-agent'] ?? null);

    noContent(res);
  },

  async unsubscribe(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const body = req.body as UnsubscribePushInput;

    await pushService.unsubscribe(user.id, body.endpoint);

    noContent(res);
  },

  async dispatch(_req: Request, res: Response): Promise<void> {
    ok(res, await pushService.dispatch());
  },
};
