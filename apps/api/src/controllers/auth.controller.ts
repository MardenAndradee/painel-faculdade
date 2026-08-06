import type { Request, Response } from 'express';
import type { GoogleScopeGroup } from '@painel/shared';
import { authService } from '../services/auth.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';
import { ok, noContent } from '../utils/http-response.js';
import { safeCompare } from '../utils/crypto.js';
import {
  REFRESH_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  clearOAuthStateCookie,
  clearRefreshCookie,
  setOAuthStateCookie,
  setRefreshCookie,
} from '../utils/cookies.js';

/**
 * Camada HTTP da autenticacao.
 *
 * Le a requisicao, delega ao service e escreve a resposta. Nenhuma regra de
 * negocio mora aqui - a manipulacao de cookies permanece no controller por ser
 * detalhe de transporte, nao de dominio.
 */

/** Dados da sessao usados para auditoria e revogacao por dispositivo. */
function sessionContext(req: Request): { userAgent: string | null; ipAddress: string | null } {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: req.ip ?? null,
  };
}

export const authController = {
  /** Inicia o fluxo OAuth redirecionando para a tela de consentimento. */
  startGoogleLogin(req: Request, res: Response): void {
    const scopes = (req.query.scopes ?? []) as GoogleScopeGroup[];

    const { url, state } = authService.buildLoginUrl(scopes);

    setOAuthStateCookie(res, state);
    res.redirect(url);
  },

  /**
   * Callback do Google.
   *
   * Termina em redirecionamento para o frontend levando apenas o cookie de
   * refresh. O access token NAO viaja na URL: isso o exporia no historico do
   * navegador, nos logs de acesso e no header Referer.
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const redirectWithError = (reason: string): void => {
      clearOAuthStateCookie(res);
      res.redirect(`${env.WEB_APP_URL}/login?error=${encodeURIComponent(reason)}`);
    };

    if (error) {
      redirectWithError(error === 'access_denied' ? 'acesso_negado' : 'falha_google');
      return;
    }

    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME] as string | undefined;

    // Protecao CSRF: o `state` devolvido pelo Google precisa bater com o que
    // guardamos no cookie ao iniciar o fluxo.
    if (!state || !expectedState || !safeCompare(state, expectedState)) {
      redirectWithError('estado_invalido');
      return;
    }

    if (!code) {
      redirectWithError('codigo_ausente');
      return;
    }

    try {
      const { refreshToken } = await authService.loginWithGoogle(code, sessionContext(req));

      clearOAuthStateCookie(res);
      setRefreshCookie(res, refreshToken);

      // O prefixo do `state` indica que a autorizacao partiu da tela de
      // integracoes; nesse caso o usuario volta para la, e nao ao dashboard.
      const scopeGroup = /^(classroom|calendar):/.exec(state)?.[1];

      if (scopeGroup) {
        res.redirect(
          `${env.WEB_APP_URL}/auth/callback?destino=integracoes&conectado=${scopeGroup}`,
        );
        return;
      }

      res.redirect(`${env.WEB_APP_URL}/auth/callback`);
    } catch (err) {
      const reason = err instanceof AppError ? err.code.toLowerCase() : 'falha_login';

      /**
       * O usuario so ve "falha_login" na URL - deliberado, porque detalhe de
       * erro em query string vaza informacao. Mas o motivo REAL precisa ficar
       * em algum lugar: sem este log, um login quebrado em producao nao tem
       * como ser diagnosticado.
       */
      logger.error('Falha no callback do Google', {
        reason,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      redirectWithError(reason);
    }
  },

  /**
   * Rotaciona a sessao e devolve um novo access token.
   *
   * Tambem e a rota usada pelo frontend no carregamento inicial para recuperar
   * a sessao a partir do cookie.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw AppError.unauthorized('Sessao nao encontrada');
    }

    try {
      const { session, refreshToken } = await authService.refreshSession(
        token,
        sessionContext(req),
      );

      setRefreshCookie(res, refreshToken);
      ok(res, session);
    } catch (error) {
      // Cookie invalido nunca deve permanecer no navegador: sem limpa-lo o
      // frontend tentaria renovar em loop a cada carregamento.
      clearRefreshCookie(res);
      throw error;
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

    await authService.logout(token);

    clearRefreshCookie(res);
    noContent(res);
  },

  async logoutAll(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    const count = await authService.logoutAll(user.id);

    clearRefreshCookie(res);
    ok(res, { revokedSessions: count });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await authService.getProfile(user.id));
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await authService.updateProfile(user.id, req.body));
  },
};
