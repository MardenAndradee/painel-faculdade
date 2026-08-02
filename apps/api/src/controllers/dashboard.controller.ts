import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP do dashboard: le o usuario autenticado e delega ao service. */
export const dashboardController = {
  async getSummary(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await dashboardService.getSummary(user.id));
  },
};
