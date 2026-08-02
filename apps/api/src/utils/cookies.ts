import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { durationToSeconds } from './jwt.js';

/**
 * Cookies de autenticacao.
 *
 * O refresh token vive em cookie httpOnly - inalcancavel por JavaScript e,
 * portanto, imune a XSS. O `path` restrito faz o navegador enviar o cookie
 * apenas nas rotas de autenticacao, e nao em toda chamada da API.
 */

export const REFRESH_COOKIE_NAME = 'painel_refresh_token';
export const OAUTH_STATE_COOKIE_NAME = 'painel_oauth_state';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    // `none` permite frontend e API em dominios distintos, mas exige Secure -
    // por isso so e usado em producao, onde o trafego e HTTPS.
    sameSite: env.isProduction ? 'none' : 'lax',
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: durationToSeconds(env.JWT_REFRESH_EXPIRES_IN) * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
  });
}

/** O `state` do OAuth e efemero: 10 minutos bastam para concluir o consent. */
export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    ...baseCookieOptions(),
    // O retorno do Google e uma navegacao top-level vinda de outro site;
    // `lax` garante que o cookie acompanhe esse redirecionamento.
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    ...baseCookieOptions(),
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}
