import type { AuthSession, AuthUser, UpdateProfileInput } from '@painel/shared';
import { API_URL, httpClient, setAccessToken } from './http-client';

/**
 * Operacoes de autenticacao consumidas pelos hooks.
 *
 * Isola os endpoints da API: componentes nunca montam URLs por conta propria.
 */
export const authService = {
  /**
   * Envia o navegador ao fluxo OAuth do Google.
   *
   * E uma navegacao completa, e nao um fetch: o consentimento acontece no
   * dominio do Google e o retorno precisa carregar o cookie httpOnly.
   */
  redirectToGoogle(scopes?: 'classroom' | 'calendar'): void {
    // `window.location.origin` como base porque `API_URL` pode ser relativo
    // (`/api/v1`) quando a API e servida pelo mesmo dominio do frontend.
    const url = new URL(`${API_URL}/auth/google`, window.location.origin);
    if (scopes) url.searchParams.set('scopes', scopes);

    window.location.href = url.toString();
  },

  /** Recupera a sessao a partir do cookie httpOnly. */
  async refresh(): Promise<AuthSession> {
    const session = await httpClient.post<AuthSession>('/auth/refresh', undefined, {
      skipAuth: true,
    });

    setAccessToken(session.accessToken);
    return session;
  },

  /**
   * Troca o token do fragmento da URL (ver `app/auth/callback`) pela sessao.
   *
   * Grava o cookie httpOnly como efeito colateral da resposta - por nao ser um
   * redirecionamento, o Safari nao encurta a validade do cookie.
   */
  async exchangeSession(token: string): Promise<AuthSession> {
    const session = await httpClient.post<AuthSession>(
      '/auth/session',
      { token },
      { skipAuth: true },
    );

    setAccessToken(session.accessToken);
    return session;
  },

  me(): Promise<AuthUser> {
    return httpClient.get<AuthUser>('/auth/me');
  },

  updateProfile(data: UpdateProfileInput): Promise<AuthUser> {
    return httpClient.patch<AuthUser>('/auth/me', data);
  },

  async logout(): Promise<void> {
    try {
      await httpClient.post<void>('/auth/logout', undefined, { skipAuth: true });
    } finally {
      // O token local e descartado mesmo se a chamada falhar: o usuario pediu
      // para sair, e a sessao do servidor expira sozinha.
      setAccessToken(null);
    }
  },

  async logoutAll(): Promise<{ revokedSessions: number }> {
    const result = await httpClient.post<{ revokedSessions: number }>('/auth/logout-all');
    setAccessToken(null);

    return result;
  },
};
