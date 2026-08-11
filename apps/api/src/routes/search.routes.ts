import { Router } from 'express';
import { searchQuerySchema } from '@painel/shared';
import { searchController } from '../controllers/search.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';

/** Rota da busca global (Etapa 19). Exige sessao ativa. */
export const searchRoutes: Router = Router();

searchRoutes.use(authenticate);

searchRoutes.get('/search', validate({ query: searchQuerySchema }), searchController.search);
