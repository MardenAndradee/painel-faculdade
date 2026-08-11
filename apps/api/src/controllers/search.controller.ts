import type { Request, Response } from 'express';
import { searchService } from '../services/search.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP da busca global (Etapa 19). */
export const searchController = {
  async search(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await searchService.search(user.id, req.query.q as string));
  },
};
