import { Router } from 'express';
import { gradeConfigurationInputSchema } from '@painel/shared';
import { authController } from '../controllers/auth.controller.js';
import { gradeConfigurationController } from '../controllers/grade-configuration.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import {
  authRateLimiter,
  passwordAuthRateLimiter,
  refreshRateLimiter,
} from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  exchangeSessionSchema,
  forgotPasswordSchema,
  googleCallbackQuerySchema,
  loginQuerySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js';

/**
 * Rotas de autenticacao.
 *
 * O limite e aplicado por rota, e nao no router inteiro: iniciar sessao e
 * renovar sessao tem perfis de uso muito diferentes.
 */
export const authRoutes: Router = Router();

// --- Publicas: Google OAuth ---------------------------------------------------

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

// Passo final do login (ver comentario em handleGoogleCallback): mesmo
// perfil de uso do refresh, entao o mesmo limite.
authRoutes.post(
  '/auth/session',
  refreshRateLimiter,
  validate({ body: exchangeSessionSchema }),
  authController.exchangeSession,
);

// --- Publicas: e-mail e senha (Etapa 26) --------------------------------------

authRoutes.post(
  '/auth/register',
  passwordAuthRateLimiter,
  validate({ body: registerSchema }),
  authController.register,
);

authRoutes.post(
  '/auth/login',
  passwordAuthRateLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

authRoutes.post(
  '/auth/forgot-password',
  passwordAuthRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);

authRoutes.post(
  '/auth/reset-password',
  passwordAuthRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

authRoutes.post(
  '/auth/verify-email',
  passwordAuthRateLimiter,
  validate({ body: verifyEmailSchema }),
  authController.verifyEmail,
);

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

// --- Metodos de login (Etapa 26) ----------------------------------------------
// "Configuracoes -> Conta": vincular/desvincular Google, adicionar/trocar senha.
// Nunca deixam a conta sem nenhum jeito de entrar - a garantia mora no service.

authRoutes.get('/auth/me/login-methods', authenticate, authController.getLoginMethods);

authRoutes.post(
  '/auth/me/link/google',
  authenticate,
  authRateLimiter,
  authController.startGoogleLink,
);

authRoutes.delete('/auth/me/link/google', authenticate, authController.unlinkGoogle);

authRoutes.post(
  '/auth/me/password',
  authenticate,
  passwordAuthRateLimiter,
  validate({ body: setPasswordSchema }),
  authController.setPassword,
);

authRoutes.patch(
  '/auth/me/password',
  authenticate,
  passwordAuthRateLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

// --- Modelo pessoal de notas (Etapa 19) ---------------------------------------
// Pre-preenche disciplinas novas (inclusive as importadas do Classroom) quando
// o semestre delas nao tem um modelo proprio. Criado automaticamente no
// primeiro login, com N1/N2/N3.

authRoutes.get(
  '/auth/me/default-grade-configuration',
  authenticate,
  gradeConfigurationController.getUserDefault,
);

authRoutes.put(
  '/auth/me/default-grade-configuration',
  authenticate,
  validate({ body: gradeConfigurationInputSchema }),
  gradeConfigurationController.replaceUserDefault,
);
