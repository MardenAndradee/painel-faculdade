import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

/** Rotas do dashboard. Todas exigem sessao ativa. */
export const dashboardRoutes: Router = Router();

dashboardRoutes.get('/dashboard/summary', authenticate, dashboardController.getSummary);
