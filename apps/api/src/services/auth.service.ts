import { randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  GOOGLE_SCOPE_GROUPS,
  type AuthSession,
  type AuthUser,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type GoogleScopeGroup,
  type LoginInput,
  type LoginMethods,
  type RegisterInput,
  type ResetPasswordInput,
  type SetPasswordInput,
  type UpdateProfileInput,
} from '@painel/shared';
import type { User } from '../generated/prisma/client.js';
import { buildConsentUrl, exchangeCodeForProfile } from '../config/google.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { authIdentityRepository } from '../repositories/auth-identity.repository.js';
import { emailTokenRepository } from '../repositories/email-token.repository.js';
import { gradeConfigurationService } from './grade-configuration.service.js';
import { semesterService } from './semester.service.js';
import { AppError } from '../utils/app-error.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { isAccountLocked, resolveGoogleLogin } from '../utils/google-link-resolution.js';
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
 *
 * Desde a Etapa 26 (autenticacao e-mail+senha) convivem dois metodos de
 * login, que podem representar o MESMO usuario quando vinculados - a decisao
 * de quando isso acontece automaticamente (Fluxos 3/4/6) vive em
 * `google-link-resolution.ts`, pura e testada por mutacao a parte. Ver
 * docs/modules/autenticacao.md para o desenho completo.
 */

interface SessionContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Limite de tentativas de senha erradas por conta (risco R2 - forca bruta
 * distribuida entre varias origens, que escaparia de um limite so por IP).
 * 15 minutos e o mesmo horizonte do rate limit por IP em `rate-limit.ts`.
 */
const PASSWORD_LOCK_THRESHOLD = 5;
const PASSWORD_LOCK_DURATION_MS = 15 * 60 * 1000;

const VERIFY_EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Curto de proposito: token de redefinicao de senha e sensivel (R6). */
const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;

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

/**
 * Bootstrap de usuario novo: modelo de notas padrao (Etapa 19) + semestre
 * atual (Etapa 31), no mesmo gatilho.
 *
 * So loga a falha - nao pode derrubar o cadastro/login. Pior caso, o usuario
 * fica sem um dos dois ate a resolucao "sob demanda" (`getOrCreateCurrent`,
 * `gradeConfigurationService.ensureForSubject`) cobrir na proxima leitura.
 *
 * Chamado nos dois fluxos de cadastro (Google e senha) - antes so o Google
 * bootstrapava; quem se cadastrava por senha ficava sem N1/N2/N3 e sem
 * semestre ate criar um a mao, que deixou de ser possivel nesta etapa.
 */
async function bootstrapNewUser(userId: string): Promise<void> {
  await Promise.all([
    gradeConfigurationService.ensureUserDefault(userId),
    semesterService.getOrCreateCurrent(userId),
  ]).catch((error: unknown) => {
    logger.warn('Falha ao bootstrapar usuario novo (modelo de notas/semestre)', {
      userId,
      message: error instanceof Error ? error.message : 'erro desconhecido',
    });
  });
}

/** E-mail invalido/inexistente e senha errada devolvem a MESMA mensagem (R3 - nao revelar se a conta existe). */
function invalidCredentials(): AppError {
  return new AppError('E-mail ou senha inválidos', 401, ERROR_CODES.UNAUTHORIZED);
}

/** Gera, hasheia e persiste um token de e-mail, devolvendo o valor EM CLARO (o que vai no link do e-mail). */
async function issueEmailToken(
  userId: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  ttlMs: number,
): Promise<string> {
  const token = randomToken(32);

  await emailTokenRepository.create({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });

  return token;
}

export const authService = {
  // --- Google OAuth --------------------------------------------------------------

  /** Monta a URL de consentimento e o `state` que protege o fluxo contra CSRF. */
  buildLoginUrl(scopeGroups: GoogleScopeGroup[] = []): { url: string; state: string } {
    const state = randomToken(32);

    return {
      url: buildConsentUrl({ state, additionalScopes: scopeGroups }),
      state,
    };
  },

  /**
   * Conclui o login com Google: troca o `code` pelos tokens, resolve a
   * identidade via `AuthIdentity` e emite a sessao da aplicacao.
   *
   * A decisao de qual conta usar - login direto, vinculo automatico (com ou
   * sem invalidar uma senha nunca comprovada) ou bloqueio - vem de
   * `resolveGoogleLogin` (Fluxos 3/4/6, risco R1). Este metodo so executa o
   * que a decisao manda.
   */
  async loginWithGoogle(
    code: string,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const { profile, tokens } = await exchangeCodeForProfile(code);
    const email = profile.email.toLowerCase();

    const [existingIdentity, existingUserByEmail] = await Promise.all([
      authIdentityRepository.findByProviderAccount('GOOGLE', profile.googleId),
      userRepository.findByEmail(email),
    ]);

    const decision = resolveGoogleLogin({
      existingIdentityUserId: existingIdentity?.userId ?? null,
      existingUserByEmail: existingUserByEmail
        ? {
            id: existingUserByEmail.id,
            emailVerifiedAt: existingUserByEmail.emailVerifiedAt,
            passwordClaimedAt: existingUserByEmail.passwordClaimedAt,
          }
        : null,
    });

    if (decision.kind === 'BLOCKED_UNVERIFIED') {
      logger.warn('Login com Google bloqueado: e-mail cadastrado e nao verificado', {
        userId: decision.userId,
      });

      throw AppError.conflict(
        'Este e-mail já está cadastrado. Entre com sua senha ou use "Esqueci minha senha".',
      );
    }

    let user: User;
    let isNewUser = false;

    if (decision.kind === 'CREATE_NEW') {
      user = await userRepository.createFromGoogle({
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
      await authIdentityRepository.create(user.id, 'GOOGLE', profile.googleId);
      isNewUser = true;
    } else if (decision.kind === 'LINK_VERIFIED') {
      await authIdentityRepository.create(decision.userId, 'GOOGLE', profile.googleId);

      if (decision.invalidatePassword) {
        await userRepository.clearPassword(decision.userId);
        logger.warn('Senha invalidada por vinculo automatico do Google (risco R1)', {
          userId: decision.userId,
        });
        // Etapa 25 (envio de e-mail, ainda planejada): avisar "sua senha foi
        // redefinida por seguranca" - ate la, o unico rastro e este log.
      }

      user = await userRepository.touchFromGoogle(decision.userId, {
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
    } else {
      user = await userRepository.touchFromGoogle(decision.userId, {
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
    }

    // Autorizacao incremental: os escopos novos somam aos ja concedidos, para
    // que conectar o Calendar depois nao apague a permissao do Classroom.
    const mergedScopes = Array.from(
      new Set([...user.googleGrantedScopes, ...tokens.grantedScopes]),
    );

    user = await userRepository.updateGoogleTokens(user.id, {
      googleAccessToken: tokens.accessToken,
      googleRefreshToken: tokens.refreshToken,
      googleTokenExpiry: tokens.expiryDate,
      grantedScopes: mergedScopes,
    });

    if (isNewUser) {
      await bootstrapNewUser(user.id);
    }

    logger.info('Login com Google realizado', {
      userId: user.id,
      isNewUser,
      decision: decision.kind,
    });

    return issueSession(user, context);
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

  /**
   * URL de consentimento para VINCULAR o Google a uma conta ja autenticada
   * (Fluxo 5). So pede escopos de identidade - vincular nao deve alterar o
   * acesso ao Classroom/Calendar, que e gerenciado a parte em Integracoes.
   *
   * O `state` prefixado com `link:` e o que o callback usa para distinguir
   * este fluxo de um login comum (ver `authController.handleGoogleCallback`).
   */
  buildLinkUrl(): { url: string; state: string } {
    const state = `link:${randomToken(32)}`;

    return { url: buildConsentUrl({ state }), state };
  },

  /**
   * Conclui o vinculo (Fluxo 5): troca o `code`, confere que o e-mail do
   * Google bate com o da conta JA AUTENTICADA (`userId`, resolvido pelo
   * controller a partir do cookie de sessao - a navegacao completa para o
   * Google e de volta perde o estado em memoria do frontend, mas o cookie
   * httpOnly sobrevive) e cria a `AuthIdentity`.
   *
   * Devolve uma sessao nova (mesma mecanica do login) para que o frontend
   * reaproveite o fluxo de troca do fragmento (`/auth/callback`) sem
   * nenhuma mudanca.
   */
  async linkGoogleAccount(
    userId: string,
    code: string,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.unauthorized('Sessao invalida');

    const { profile } = await exchangeCodeForProfile(code);

    // Fluxo 6: e-mail diferente - nunca vincula silenciosamente.
    if (profile.email.toLowerCase() !== user.email.toLowerCase()) {
      throw AppError.conflict(
        `Esta conta Google usa outro e-mail (${profile.email}). Entre com a conta certa ou vincule depois de trocar seu e-mail aqui.`,
      );
    }

    const existingIdentity = await authIdentityRepository.findByProviderAccount(
      'GOOGLE',
      profile.googleId,
    );

    // Fluxo 7: essa conta Google ja pertence a OUTRO usuario do Painel.
    if (existingIdentity && existingIdentity.userId !== userId) {
      throw AppError.conflict('Esta conta Google já está vinculada a outro usuário do Painel.');
    }

    // Idempotente: se ja estava vinculada a esta mesma conta, so segue.
    if (!existingIdentity) {
      await authIdentityRepository.create(userId, 'GOOGLE', profile.googleId);
    }

    logger.info('Google vinculado a conta existente', { userId });

    return issueSession(user, context);
  },

  /** Desvincula o Google (Fluxo 5/7). Nunca remove o ultimo metodo de login. */
  async unlinkGoogle(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuario');

    if (!user.passwordHash) {
      throw AppError.conflict(
        'Defina uma senha antes de desvincular o Google - sua conta ficaria sem nenhum jeito de entrar.',
      );
    }

    const removed = await authIdentityRepository.deleteByUserAndProvider(userId, 'GOOGLE');

    if (!removed) throw AppError.notFound('Vínculo com o Google');

    logger.info('Google desvinculado', { userId });
  },

  // --- E-mail e senha (Etapa 26) -------------------------------------------------

  /**
   * Cadastro por senha (Fluxo 1). Loga imediatamente - a conta fica marcada
   * como nao verificada e por isso fora do auto-link do Google (Fluxo 3/4)
   * ate a verificacao acontecer.
   */
  async register(
    input: RegisterInput,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const existing = await userRepository.findByEmail(input.email);

    if (existing) {
      throw AppError.conflict('Este e-mail já está cadastrado', {
        email: ['Este e-mail já está cadastrado'],
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.createWithPassword({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    await bootstrapNewUser(user.id);

    const token = await issueEmailToken(user.id, 'VERIFY_EMAIL', VERIFY_EMAIL_TOKEN_TTL_MS);

    // Etapa 25 (envio de e-mail) ainda planejada - loga o link em vez de
    // enviar de verdade. O fluxo fica code-complete: no dia em que o envio
    // existir, e so trocar este log por uma chamada ao provedor.
    logger.info('Cadastro por senha realizado - link de verificacao gerado', {
      userId: user.id,
      verifyLink: `${env.WEB_APP_URL}/verificar-email?token=${token}`,
    });

    return issueSession(user, context);
  },

  /** Login por senha (Fluxo 2), com limite por conta (R2) e mensagem generica (R3). */
  async login(
    input: LoginInput,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const user = await userRepository.findByEmail(input.email);

    // Conta inexistente OU so-Google: mesma mensagem, sempre (R3) - dizer
    // "esta conta usa Google" a quem nao provou a senha e enumeracao de
    // usuario.
    if (!user || !user.passwordHash) {
      throw invalidCredentials();
    }

    if (isAccountLocked(user.lockedUntil, new Date())) {
      throw new AppError(
        'Muitas tentativas com esta conta. Tente novamente em alguns minutos.',
        429,
        ERROR_CODES.RATE_LIMITED,
      );
    }

    const matches = await verifyPassword(user.passwordHash, input.password);

    if (!matches) {
      await userRepository.recordFailedLogin(
        user.id,
        PASSWORD_LOCK_THRESHOLD,
        PASSWORD_LOCK_DURATION_MS,
      );

      throw invalidCredentials();
    }

    await userRepository.resetFailedLogins(user.id);
    // Primeiro login bem-sucedido com esta senha: base do refinamento de R1
    // (ver google-link-resolution.ts) - so aqui a senha passa a ser tratada
    // como "provada pelo dono de verdade".
    await userRepository.markPasswordClaimed(user.id);

    logger.info('Login por senha realizado', { userId: user.id });

    return issueSession(user, context);
  },

  /** "Esqueci minha senha" - resposta SEMPRE identica, exista ou nao a conta (R3). */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await userRepository.findByEmail(input.email);

    // Conta inexistente ou so-Google: nada a fazer, mas o CHAMADOR nunca
    // sabe disso - o controller responde a mesma coisa em qualquer caso.
    if (!user || !user.passwordHash) return;

    await emailTokenRepository.invalidatePending(user.id, 'RESET_PASSWORD');
    const token = await issueEmailToken(user.id, 'RESET_PASSWORD', RESET_PASSWORD_TOKEN_TTL_MS);

    logger.info('Link de redefinicao de senha gerado (envio de e-mail pendente - Etapa 25)', {
      userId: user.id,
      resetLink: `${env.WEB_APP_URL}/redefinir-senha?token=${token}`,
    });
  },

  /**
   * Conclui a redefinicao via token emailado.
   *
   * Completar isto e uma prova mais forte que um simples clique de
   * verificacao: exige controlar a caixa de entrada E escolher a nova senha.
   * Por isso tambem marca o e-mail como verificado (se ainda nao estava) e
   * conta como a senha "provada" - fecha a mesma lacuna de R1 pelo caminho
   * inverso, dando a vitima real um jeito de retomar um e-mail ocupado.
   */
  async resetPassword(
    input: ResetPasswordInput,
    context: SessionContext,
  ): Promise<{ session: AuthSession; refreshToken: string }> {
    const record = await emailTokenRepository.findByHash(hashToken(input.token));

    if (
      !record ||
      record.purpose !== 'RESET_PASSWORD' ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw AppError.badRequest('Link inválido ou expirado');
    }

    const passwordHash = await hashPassword(input.password);

    await userRepository.setPassword(record.userId, passwordHash, true);
    await userRepository.markEmailVerified(record.userId);
    await emailTokenRepository.markUsed(record.id);

    // Encerra qualquer sessao existente: se a conta foi comprometida (por
    // isso a pessoa esta redefinindo por e-mail em vez de so trocar a
    // senha), uma sessao de invasor ativa nao pode sobreviver a
    // redefinicao. Nao ha sessao "atual" a preservar aqui - a proxima
    // linha emite uma do zero.
    await refreshTokenRepository.revokeAllForUser(record.userId);

    const user = await userRepository.findById(record.userId);

    if (!user) throw AppError.badRequest('Link inválido ou expirado');

    logger.info('Senha redefinida via token de e-mail', { userId: user.id });

    return issueSession(user, context);
  },

  /** Confirma o e-mail a partir do token de cadastro (Fluxo 1). */
  async verifyEmail(token: string): Promise<void> {
    const record = await emailTokenRepository.findByHash(hashToken(token));

    if (
      !record ||
      record.purpose !== 'VERIFY_EMAIL' ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw AppError.badRequest('Link inválido ou expirado');
    }

    await userRepository.markEmailVerified(record.userId);
    await emailTokenRepository.markUsed(record.id);

    logger.info('E-mail verificado', { userId: record.userId });
  },

  /** Metodos de login da conta (Configuracoes -> Conta). */
  async getLoginMethods(userId: string): Promise<LoginMethods> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuario');

    const identities = await authIdentityRepository.findAllByUser(userId);

    return {
      hasPassword: user.passwordHash !== null,
      emailVerified: user.emailVerifiedAt !== null,
      linkedProviders: identities.map((identity) => identity.provider),
    };
  },

  /** "Adicionar senha" numa conta hoje so-Google. */
  async setPassword(userId: string, input: SetPasswordInput): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuario');

    if (user.passwordHash) {
      throw AppError.conflict('Esta conta já tem senha - use a opção de trocar senha.');
    }

    const passwordHash = await hashPassword(input.password);

    // Autenticado + definindo a propria senha pela primeira vez: e a propria
    // pessoa provando controle da conta, tanto quanto um login bem-sucedido.
    await userRepository.setPassword(userId, passwordHash, true);

    logger.info('Senha definida', { userId });
  },

  /**
   * Troca de senha, exigindo a senha atual.
   *
   * `currentSessionTokenHash` (o hash do refresh token do PROPRIO
   * dispositivo que fez a troca, resolvido pelo controller a partir do
   * cookie) fica de fora da revogacao abaixo - so as demais sessoes sao
   * encerradas. Sem essa excecao, trocar a senha deslogaria a pessoa do
   * dispositivo que ela esta usando agora mesmo.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentSessionTokenHash?: string,
  ): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user?.passwordHash) {
      throw AppError.conflict('Esta conta ainda não tem senha - use a opção de adicionar senha.');
    }

    const matches = await verifyPassword(user.passwordHash, input.currentPassword);

    if (!matches) {
      throw AppError.badRequest('Senha atual incorreta', {
        currentPassword: ['Senha atual incorreta'],
      });
    }

    const passwordHash = await hashPassword(input.newPassword);

    await userRepository.setPassword(userId, passwordHash, true);
    // Uma sessao roubada em outro dispositivo nao pode sobreviver a troca de
    // senha - e o motivo de seguranca mais comum para trocar a senha.
    await refreshTokenRepository.revokeAllForUser(userId, currentSessionTokenHash);

    logger.info('Senha alterada', { userId });
  },

  // --- Sessao ----------------------------------------------------------------------

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
};
