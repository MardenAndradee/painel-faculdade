import { Router } from 'express';
import { subscribePushSchema, unsubscribePushSchema } from '@painel/shared';
import { pushController } from '../controllers/push.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { cronAuth } from '../middlewares/cron-auth.js';
import { validate } from '../middlewares/validate.js';

/** Rotas de Push Notifications (Etapa 28.11). */
export const pushRoutes: Router = Router();

// Chamada pelo Vercel Cron, nao por um usuario - segredo compartilhado em
// vez de sessao. Registrada antes do `authenticate` abaixo para não herdá-lo.
// GET porque e assim que o Vercel Cron invoca (nao ha como configurar outro
// metodo em `vercel.json`), mesmo o disparo tendo efeito colateral.
pushRoutes.get('/push/dispatch', cronAuth, pushController.dispatch);

pushRoutes.use(authenticate);

pushRoutes.post(
  '/push/subscribe',
  validate({ body: subscribePushSchema }),
  pushController.subscribe,
);

pushRoutes.post(
  '/push/unsubscribe',
  validate({ body: unsubscribePushSchema }),
  pushController.unsubscribe,
);
