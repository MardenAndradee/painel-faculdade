import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@painel/shared';
import { integrationController } from '../controllers/integration.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

/** Rotas das integracoes. Todas exigem sessao ativa. */
export const integrationRoutes: Router = Router();

integrationRoutes.use(authenticate);

/**
 * Limite proprio da sincronizacao.
 *
 * Cada execucao faz varias chamadas a API do Google, que tem cota diaria.
 * Deixar o usuario clicar "Sincronizar" sem parar esgotaria a cota da conta.
 */
const syncRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Aguarde alguns minutos antes de sincronizar novamente.',
    },
  },
});

integrationRoutes.get('/integrations/status', integrationController.status);

/**
 * Disparada quando o app abre.
 *
 * Sem o `syncRateLimiter`: o teto de verdade e o intervalo de 30 minutos que o
 * SERVICE aplica olhando `classroomSyncedAt`. Chamadas dentro da janela nem
 * chegam ao Google - respondem "pulei" de imediato -, entao limita-las aqui so
 * transformaria uma resposta correta num 429 confuso ao trocar de aba.
 */
integrationRoutes.post(
  '/integrations/classroom/auto-sync',
  integrationController.autoSyncClassroom,
);

integrationRoutes.get('/integrations/classroom/connect', integrationController.connectClassroom);

integrationRoutes.post(
  '/integrations/classroom/sync',
  syncRateLimiter,
  integrationController.syncClassroom,
);

integrationRoutes.delete('/integrations/classroom', integrationController.disconnectClassroom);

// --- Google Calendar -----------------------------------------------------------

integrationRoutes.get('/integrations/calendar/connect', integrationController.connectCalendar);

integrationRoutes.post(
  '/integrations/calendar/sync',
  syncRateLimiter,
  integrationController.syncCalendar,
);

integrationRoutes.delete('/integrations/calendar', integrationController.disconnectCalendar);
