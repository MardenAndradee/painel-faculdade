import { Router } from 'express';
import { subscribePushSchema, unsubscribePushSchema } from '@painel/shared';
import { pushController } from '../controllers/push.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { cronAuth } from '../middlewares/cron-auth.js';
import { validate } from '../middlewares/validate.js';

/**
 * Rota pública do cron (Etapa 28.11) - segredo compartilhado em vez de
 * sessão de usuário. Router SEPARADO de propósito: `pushRoutes` abaixo tem
 * `.use(authenticate)` sem caminho, que rodaria para QUALQUER request que
 * caia nele, mesmo uma que nenhuma rota sua atenda - colocar essa rota no
 * mesmo router e registrá-lo cedo (antes de `authRoutes`) já quebrou login
 * em produção uma vez (o `authenticate` interceptava `/auth/google` antes
 * de ele chegar em `authRoutes`). Este router nunca deve ganhar uma rota
 * autenticada.
 */
export const pushCronRoutes: Router = Router();

// GET porque e assim que o Vercel Cron invoca (nao ha como configurar outro
// metodo em `vercel.json`), mesmo o disparo tendo efeito colateral.
pushCronRoutes.get('/push/dispatch', cronAuth, pushController.dispatch);

/** Rotas de Push Notifications que exigem sessão (Etapa 28.11). */
export const pushRoutes: Router = Router();

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
