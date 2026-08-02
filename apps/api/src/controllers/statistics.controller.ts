import type { Request, Response } from 'express';
import type { StatisticsQuery } from '@painel/shared';
import { statisticsService } from '../services/statistics.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP das estatisticas. */
export const statisticsController = {
  async get(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await statisticsService.getStatistics(user.id, req.query as unknown as StatisticsQuery),
    );
  },
};
