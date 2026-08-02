import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_SCOPE_GROUPS, type GoogleScopeGroup } from '@painel/shared';
import { env } from './env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Cliente OAuth2 do Google.
 *
 * No login pedimos apenas identidade (openid/email/profile). Os escopos de
 * Classroom e Calendar sao solicitados de forma incremental, quando o usuario
 * aciona a sincronizacao - menor privilegio, e ninguem e recebido com um
 * pedido de acesso ao calendario antes de conhecer o produto.
 */

const IDENTITY_SCOPES = ['openid', 'email', 'profile'];

export function createGoogleClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw AppError.internal(
      'Google OAuth nao configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.',
    );
  }

  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  });
}

interface ConsentUrlOptions {
  state: string;
  /** Escopos extras solicitados de forma incremental (Etapas 8 e 9). */
  additionalScopes?: GoogleScopeGroup[];
  loginHint?: string;
}

export function buildConsentUrl({
  state,
  additionalScopes = [],
  loginHint,
}: ConsentUrlOptions): string {
  const client = createGoogleClient();

  const scopes = [
    ...IDENTITY_SCOPES,
    ...additionalScopes.flatMap((group) => [...GOOGLE_SCOPE_GROUPS[group]]),
  ];

  return client.generateAuthUrl({
    // `offline` e o que faz o Google devolver um refresh token, necessario
    // para sincronizar sem o usuario presente.
    access_type: 'offline',
    scope: scopes,
    state,
    // Mantem os escopos ja concedidos ao pedir novos, evitando que o usuario
    // perca permissoes concedidas antes.
    include_granted_scopes: true,
    // Sem `consent` o Google omite o refresh token em autorizacoes repetidas.
    prompt: additionalScopes.length > 0 ? 'consent' : 'select_account',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface GoogleTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: Date | null;
  grantedScopes: string[];
}

/**
 * Troca o `code` recebido no callback pelos tokens do Google e extrai o perfil
 * do id_token (JWT assinado pelo proprio Google, verificado pela biblioteca).
 */
export async function exchangeCodeForProfile(code: string): Promise<{
  profile: GoogleProfile;
  tokens: GoogleTokens;
}> {
  const client = createGoogleClient();

  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw AppError.unauthorized('Google nao retornou identidade do usuario');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw AppError.unauthorized('Perfil do Google incompleto');
  }

  if (payload.email_verified === false) {
    throw AppError.forbidden('E-mail do Google nao verificado');
  }

  return {
    profile: {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0] ?? 'Estudante',
      avatarUrl: payload.picture ?? null,
    },
    tokens: {
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      grantedScopes: tokens.scope?.split(' ') ?? [],
    },
  };
}
