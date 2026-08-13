import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@painel/shared';
import { env } from '../config/env.js';

/**
 * Dois limites distintos: um geral para a API e um bem mais restrito para
 * autenticacao, onde tentativas repetidas indicam ataque de forca bruta.
 */

const payload = {
  success: false,
  error: {
    code: ERROR_CODES.RATE_LIMITED,
    message: 'Muitas requisicoes. Tente novamente em alguns minutos.',
  },
};

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: payload,
  // Health check precisa continuar respondendo para o orquestrador.
  skip: (req) => req.path === '/health',
});

/**
 * Limite estrito para inicio de sessao.
 *
 * Aplica-se ao fluxo OAuth, onde tentativas repetidas indicam abuso e nao uso
 * legitimo: um usuario real faz login poucas vezes por dia.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: payload,
});

/**
 * Limite proprio para renovacao de sessao.
 *
 * `/auth/refresh` e chamado a cada carregamento de pagina e a cada expiracao
 * do access token - varias abas abertas ou alguns recarregamentos estourariam
 * o limite de login e deslogariam quem esta usando o sistema normalmente.
 * Ainda assim e limitado: renovacao em massa continua sendo sinal de abuso.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: payload,
});

/**
 * Limite dedicado para entrar em turma (Etapa 20).
 *
 * Um token de convite e curto e de alta entropia, mas nao ilimitadamente
 * grande - sem um limite proprio aqui, tentar tokens ao acaso vira viavel em
 * volume. Bem mais generoso que login: clicar num link de convite e uma
 * acao legitima e pontual, nao repetida ao longo do dia.
 */
export const classJoinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: payload,
});
