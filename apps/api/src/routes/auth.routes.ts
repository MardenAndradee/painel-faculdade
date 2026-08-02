import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authRateLimiter, refreshRateLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import {
  googleCallbackQuerySchema,
  loginQuerySchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

/**
 * Rotas de autenticacao.
 *
 * O limite e aplicado por rota, e nao no router inteiro: iniciar sessao e
 * renovar sessao tem perfis de uso muito diferentes.
 */
export const authRoutes: Router = Router();

// --- Publicas ---------------------------------------------------------------

authRoutes.get(
  '/auth/google',
  authRateLimiter,
  validate({ query: loginQuerySchema }),
  authController.startGoogleLogin,
);

authRoutes.get(
  '/auth/google/callback',
  authRateLimiter,
  validate({ query: googleCallbackQuerySchema }),
  authController.handleGoogleCallback,
);

// Renovacao ocorre a cada carregamento de pagina: limite proprio, mais folgado.
authRoutes.post('/auth/refresh', refreshRateLimiter, authController.refresh);
authRoutes.post('/auth/logout', refreshRateLimiter, authController.logout);

// --- Protegidas -------------------------------------------------------------
// Cobertas pelo limite geral da API; apenas a revogacao em massa recebe o
// limite estrito, por ser destrutiva.

authRoutes.get('/auth/me', authenticate, authController.me);

authRoutes.patch(
  '/auth/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);

authRoutes.post('/auth/logout-all', authRateLimiter, authenticate, authController.logoutAll);
