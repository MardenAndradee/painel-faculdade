import { Router } from 'express';
import { notificationQuerySchema } from '@painel/shared';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas da central de notificacoes (Etapa 19). Todas exigem sessao ativa. */
export const notificationRoutes: Router = Router();

notificationRoutes.use(authenticate);

// A contagem vem antes de `/notifications/:id/...` nao por precedencia (as
// rotas nao colidem), mas porque e a chamada mais frequente: o cabecalho a
// consulta em toda tela.
notificationRoutes.get('/notifications/unread-count', notificationController.unreadCount);

notificationRoutes.get(
  '/notifications',
  validate({ query: notificationQuerySchema }),
  notificationController.list,
);

notificationRoutes.patch(
  '/notifications/:id/read',
  validate({ params: idParamSchema }),
  notificationController.markAsRead,
);

notificationRoutes.post('/notifications/read-all', notificationController.markAllAsRead);
