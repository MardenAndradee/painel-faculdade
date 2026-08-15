import type { Request, Response } from 'express';
import type { GoogleScopeGroup } from '@painel/shared';
import { authService } from '../services/auth.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';
import { ok, created, noContent } from '../utils/http-response.js';
import { safeCompare, hashToken } from '../utils/crypto.js';
import { verifyRefreshToken } from '../utils/jwt.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
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

/**
 * Identifica o usuario logado a partir do cookie de sessao, para o fluxo de
 * VINCULO do Google (Fluxo 5).
 *
 * A navegacao completa ate o Google e de volta perde qualquer estado em
 * memoria do frontend (o access token so existe la) - mas o cookie httpOnly
 * sobrevive a navegacao, entao e ele que identifica "quem estava logado
 * quando isto comecou". Mesma leitura que `POST /auth/refresh` faz, sem
 * rotacionar o token aqui - so precisamos do `userId`.
 */
async function resolveUserIdFromCookie(req: Request): Promise<string | null> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  if (!token) return null;

  try {
    const payload = verifyRefreshToken(token);
    const record = await refreshTokenRepository.findByHash(hashToken(token));

    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

    return payload.sub;
  } catch {
    return null;
  }
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
   * Inicia o vinculo do Google a uma conta ja autenticada (Fluxo 5).
   *
   * Devolve a URL em vez de redirecionar: e chamada via `fetch` autenticado
   * (precisa do header `Authorization`, que uma navegacao de pagina inteira
   * nao consegue enviar); o FRONTEND navega para a URL devolvida.
   */
  startGoogleLink(_req: Request, res: Response): void {
    const { url, state } = authService.buildLinkUrl();

    setOAuthStateCookie(res, state);
    ok(res, { url });
  },

  /**
   * Callback do Google.
   *
   * Termina em redirecionamento para o frontend levando o refresh token no
   * FRAGMENTO da URL (`#session=...`) - nunca a query string. O fragmento
   * nunca chega ao servidor (nem ao nosso, nem a proxies, nem a logs de
   * acesso), e o frontend o remove da barra de enderecos assim que le.
   *
   * O cookie NAO e gravado aqui de proposito: o Safari (ITP) limita a
   * validade de cookies gravados numa resposta de redirecionamento logo apos
   * uma navegacao vinda de outro site (o Google), ignorando silenciosamente o
   * `maxAge` configurado - o usuario ficaria sendo deslogado sem motivo
   * aparente. `POST /auth/session` troca esse token pela sessao via um
   * `fetch` comum, fora de qualquer cadeia de redirecionamento, onde o
   * cookie e gravado com a validade correta. O access token, por sua vez,
   * segue nunca viajando pela URL - isso o exporia no historico do
   * navegador, nos logs de acesso e no header Referer.
   *
   * O prefixo do `state` decide qual fluxo concluir: `link:` e o vinculo do
   * Google (Etapa 26, Fluxo 5); `classroom:`/`calendar:` e a autorizacao
   * incremental das integracoes; sem prefixo e o login comum.
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

    const isLinkFlow = state.startsWith('link:');

    try {
      const { refreshToken } = isLinkFlow
        ? await (async () => {
            const userId = await resolveUserIdFromCookie(req);

            if (!userId) {
              throw AppError.unauthorized('Sessao expirada - entre novamente antes de vincular');
            }

            return authService.linkGoogleAccount(userId, code, sessionContext(req));
          })()
        : await authService.loginWithGoogle(code, sessionContext(req));

      clearOAuthStateCookie(res);

      const fragment = `#session=${encodeURIComponent(refreshToken)}`;

      if (isLinkFlow) {
        res.redirect(`${env.WEB_APP_URL}/auth/callback?destino=conta&vinculado=google${fragment}`);
        return;
      }

      // O prefixo do `state` indica que a autorizacao partiu da tela de
      // integracoes; nesse caso o usuario volta para la, e nao ao dashboard.
      const scopeGroup = /^(classroom|calendar):/.exec(state)?.[1];

      if (scopeGroup) {
        res.redirect(
          `${env.WEB_APP_URL}/auth/callback?destino=integracoes&conectado=${scopeGroup}${fragment}`,
        );
        return;
      }

      res.redirect(`${env.WEB_APP_URL}/auth/callback${fragment}`);
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
        isLinkFlow,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      if (isLinkFlow) {
        // O vinculo falhou, mas a pessoa continua logada (a falha nao mexeu
        // na sessao atual) - devolve para Configuracoes com o motivo, em vez
        // do tratamento generico de erro de LOGIN.
        clearOAuthStateCookie(res);
        res.redirect(
          `${env.WEB_APP_URL}/configuracoes?tab=conta&erroVinculo=${encodeURIComponent(reason)}`,
        );
        return;
      }

      redirectWithError(reason);
    }
  },

  /**
   * Troca o token recebido no fragmento do callback pela sessao.
   *
   * Usa a MESMA rotina do refresh comum (`authService.refreshSession`): o
   * token do callback e um refresh token igual a qualquer outro, so que
   * chega no corpo da requisicao em vez do cookie porque, nesse momento, o
   * cookie ainda nao existe. Ver o comentario em `handleGoogleCallback`.
   */
  async exchangeSession(req: Request, res: Response): Promise<void> {
    const { token } = req.body as { token: string };

    try {
      const { session, refreshToken } = await authService.refreshSession(
        token,
        sessionContext(req),
      );

      setRefreshCookie(res, refreshToken);
      ok(res, session);
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
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

  // --- E-mail e senha (Etapa 26) -------------------------------------------------

  async register(req: Request, res: Response): Promise<void> {
    const { session, refreshToken } = await authService.register(req.body, sessionContext(req));

    setRefreshCookie(res, refreshToken);
    created(res, session);
  },

  async login(req: Request, res: Response): Promise<void> {
    const { session, refreshToken } = await authService.login(req.body, sessionContext(req));

    setRefreshCookie(res, refreshToken);
    ok(res, session);
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.forgotPassword(req.body);

    // Resposta identica exista ou nao a conta (R3) - o service ja decide por
    // dentro se algo de fato foi enviado.
    ok(res, { message: 'Se este e-mail existir, enviamos um link de redefinição.' });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { session, refreshToken } = await authService.resetPassword(
      req.body,
      sessionContext(req),
    );

    setRefreshCookie(res, refreshToken);
    ok(res, session);
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.body as { token: string };

    await authService.verifyEmail(token);

    noContent(res);
  },

  async getLoginMethods(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await authService.getLoginMethods(user.id));
  },

  async unlinkGoogle(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await authService.unlinkGoogle(user.id);
    noContent(res);
  },

  async setPassword(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await authService.setPassword(user.id, req.body);
    noContent(res);
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    // O cookie de refresh viaja em qualquer rota sob /api/v1/auth (inclusive
    // esta) - seu hash e o que identifica "a sessao deste dispositivo" para
    // o service preservar, ao revogar as demais.
    const currentToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

    await authService.changePassword(
      user.id,
      req.body,
      currentToken ? hashToken(currentToken) : undefined,
    );
    noContent(res);
  },
};
