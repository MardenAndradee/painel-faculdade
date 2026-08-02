import { randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  GOOGLE_SCOPE_GROUPS,
  type AuthSession,
  type AuthUser,
  type GoogleScopeGroup,
  type UpdateProfileInput,
} from '@painel/shared';
import type { User } from '../generated/prisma/client.js';
import { buildConsentUrl, exchangeCodeForProfile } from '../config/google.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { AppError } from '../utils/app-error.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import {
  durationToSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

/**
 * Regra de negocio da autenticacao.
 *
 * Nao conhece `req`/`res`: recebe dados simples e devolve dados simples, o que
 * torna cada caso de uso testavel sem subir servidor HTTP.
 */

interface SessionContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/** Converte a entidade do banco no formato publico, sem campos sensiveis. */
function toAuthUser(user: User): AuthUser {
  const granted = user.googleGrantedScopes ?? [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    theme: user.theme,
    timezone: user.timezone,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
    // Baseado nos escopos realmente concedidos, e nao em heuristica.
    hasClassroomAccess: GOOGLE_SCOPE_GROUPS.classroom.some((s) => granted.includes(s)),
    hasCalendarAccess: GOOGLE_SCOPE_GROUPS.calendar.some((s) => granted.includes(s)),
  };
}

/**
 * Emite o par de tokens e registra a sessao.
 *
 * O refresh token e assinado com o id do registro (`jti`), o que permite
 * revoga-lo individualmente; o banco guarda somente o hash do valor emitido.
 */
async function issueSession(
  user: User,
  context: SessionContext,
): Promise<{ session: AuthSession; refreshToken: string }> {
  const expiresInSeconds = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

  // O id e gerado aqui para que o token possa ser assinado antes da escrita:
  // assim a linha nasce ja com o hash definitivo, em uma unica operacao.
  const tokenId = randomUUID();
  const refreshToken = signRefreshToken(user.id, tokenId);

  await refreshTokenRepository.create({
    id: tokenId,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  return {
    session: {
      user: toAuthUser(user),
      accessToken: signAccessToken(user.id, user.email),
      expiresIn: durationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
    },
    refreshToken,
  };
}

export const authService = {
  /** Monta a URL de consentimento e o `state` que protege o fluxo contra CSRF. */
  buildLoginUrl(scopeGroups: GoogleScopeGroup[] = []): { url: string; state: string } {
    const state = randomToken(32);

    return {
      url: buildConsentUrl({ state, additionalScopes: scopeGroups }),
      state,
    };
  },

  /**
   * Conclui o login: troca o `code` pelos tokens do Google, cria ou atualiza o
   * usuario e emite a sessao da aplicacao.
   */
  async loginWithGoogle(
    code: string,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const { profile, tokens } = await exchangeCodeForProfile(code);

    const existingByEmail = await userRepository.findByEmail(profile.email);

    // Mesmo e-mail com outro googleId indica conta distinta reutilizando o
    // endereco. Bloqueamos para nao entregar os dados do titular anterior.
    if (existingByEmail && existingByEmail.googleId !== profile.googleId) {
      throw new AppError(
        'Este e-mail ja esta vinculado a outra conta Google',
        409,
        ERROR_CODES.CONFLICT,
      );
    }

    const user = await userRepository.upsertFromGoogle(profile);

    // Autorizacao incremental: os escopos novos somam aos ja concedidos, para
    // que conectar o Calendar depois nao apague a permissao do Classroom.
    const mergedScopes = Array.from(
      new Set([...(existingByEmail?.googleGrantedScopes ?? []), ...tokens.grantedScopes]),
    );

    await userRepository.updateGoogleTokens(user.id, {
      googleAccessToken: tokens.accessToken,
      googleRefreshToken: tokens.refreshToken,
      googleTokenExpiry: tokens.expiryDate,
      grantedScopes: mergedScopes,
    });

    logger.info('Login realizado', { userId: user.id });

    return issueSession(user, context);
  },

  /**
   * Rotaciona a sessao: valida o refresh token, revoga o atual e emite um novo par.
   *
   * Reapresentar um token ja revogado indica roubo - nesse caso todas as
   * sessoes do usuario sao derrubadas, forcando novo login.
   */
  async refreshSession(
    token: string,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const payload = verifyRefreshToken(token);
    const record = await refreshTokenRepository.findByHash(hashToken(token));

    if (!record) {
      throw new AppError('Sessao invalida', 401, ERROR_CODES.INVALID_TOKEN);
    }

    if (record.revokedAt) {
      logger.warn('Reuso de refresh token detectado', { userId: record.userId });
      await refreshTokenRepository.revokeAllForUser(record.userId);

      throw new AppError(
        'Sessao comprometida. Faca login novamente.',
        401,
        ERROR_CODES.INVALID_TOKEN,
      );
    }

    if (record.expiresAt < new Date()) {
      throw new AppError('Sessao expirada', 401, ERROR_CODES.EXPIRED_TOKEN);
    }

    const user = await userRepository.findById(payload.sub);

    if (!user) {
      throw AppError.unauthorized('Usuario nao encontrado');
    }

    await refreshTokenRepository.revoke(record.id);

    return issueSession(user, context);
  },

  /** Encerra apenas a sessao atual, preservando os demais dispositivos. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    const record = await refreshTokenRepository.findByHash(hashToken(token));

    if (record && !record.revokedAt) {
      await refreshTokenRepository.revoke(record.id);
      logger.info('Logout realizado', { userId: record.userId });
    }
  },

  /** Encerra todas as sessoes do usuario em todos os dispositivos. */
  async logoutAll(userId: string): Promise<number> {
    const count = await refreshTokenRepository.revokeAllForUser(userId);
    logger.info('Todas as sessoes encerradas', { userId, count });

    return count;
  },

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuario');

    return toAuthUser(user);
  },

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<AuthUser> {
    const user = await userRepository.update(userId, data);

    return toAuthUser(user);
  },

  /**
   * Escopos extras (Classroom/Calendar) pedidos sob demanda.
   *
   * O `state` carrega o grupo solicitado no prefixo para que o callback saiba
   * de onde o usuario veio e devolva-o a tela de integracoes, e nao ao
   * dashboard. A parte aleatoria continua sendo o que protege contra CSRF.
   */
  buildScopeUpgradeUrl(group: GoogleScopeGroup): { url: string; state: string } {
    if (!(group in GOOGLE_SCOPE_GROUPS)) {
      throw AppError.badRequest('Grupo de permissoes invalido');
    }

    const state = `${group}:${randomToken(32)}`;

    return { url: buildConsentUrl({ state, additionalScopes: [group] }), state };
  },
};
