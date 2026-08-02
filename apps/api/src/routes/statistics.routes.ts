import { Router } from 'express';
import { statisticsQuerySchema } from '@painel/shared';
import { statisticsController } from '../controllers/statistics.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';

/** Rota de estatisticas. Exige sessao ativa. */
export const statisticsRoutes: Router = Router();

statisticsRoutes.use(authenticate);

statisticsRoutes.get(
  '/statistics',
  validate({ query: statisticsQuerySchema }),
  statisticsController.get,
);
