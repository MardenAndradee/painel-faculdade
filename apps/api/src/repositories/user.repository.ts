import { prisma } from '../config/prisma.js';
import type { User } from '../generated/prisma/client.js';

/**
 * Acesso a dados de usuario.
 *
 * Unica camada autorizada a falar com o Prisma. Services dependem apenas
 * destas funcoes, o que permite trocar a persistencia sem tocar na regra
 * de negocio.
 */

export interface GoogleProfileData {
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface GoogleTokenData {
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;
  /** Escopos concedidos nesta autorizacao. Omitir mantem os ja registrados. */
  grantedScopes?: string[];
}

export const userRepository = {
  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  /**
   * Cria um usuario a partir de um login social (Google) pela primeira vez.
   *
   * `emailVerifiedAt` ja nasce preenchido: o Google so chega ate aqui apos
   * `email_verified` ser conferido em `google.ts`, entao nao ha o que
   * verificar de novo. Sem `passwordHash` - a pessoa so ganha senha se
   * escolher "Adicionar senha" depois.
   */
  createFromGoogle(profile: GoogleProfileData): Promise<User> {
    return prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerifiedAt: new Date(),
        lastLogin: new Date(),
      },
    });
  },

  /** Atualiza nome/avatar/ultimo-login num login social repetido. */
  touchFromGoogle(userId: string, profile: GoogleProfileData): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        lastLogin: new Date(),
      },
    });
  },

  /**
   * Cria um usuario a partir do cadastro por senha.
   *
   * `emailVerifiedAt` fica nulo: ninguem verificou este e-mail ainda (ver
   * `EmailToken`, proposito VERIFY_EMAIL). Ate a verificacao, esta conta fica
   * de fora do auto-link de um Google com o mesmo e-mail (risco R1).
   */
  createWithPassword(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        lastLogin: new Date(),
      },
    });
  },

  /**
   * Persiste os tokens do Google usados pelas sincronizacoes.
   *
   * O refresh token so e sobrescrito quando o Google devolve um novo: em
   * autorizacoes repetidas ele vem vazio, e gravar `null` por cima destruiria
   * o acesso offline ja concedido.
   */
  updateGoogleTokens(userId: string, tokens: GoogleTokenData): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: tokens.googleAccessToken,
        googleTokenExpiry: tokens.googleTokenExpiry,
        ...(tokens.googleRefreshToken ? { googleRefreshToken: tokens.googleRefreshToken } : {}),
        // Escopos sao acumulativos: autorizacao incremental adiciona sem
        // remover o que ja havia sido concedido antes.
        ...(tokens.grantedScopes ? { googleGrantedScopes: tokens.grantedScopes } : {}),
      },
    });
  },

  update(
    userId: string,
    data: { name?: string; theme?: User['theme']; timezone?: string },
  ): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data });
  },

  // --- Senha (Etapa 26) ---------------------------------------------------------

  /**
   * Grava um novo hash de senha.
   *
   * `claim`, quando true, tambem marca `passwordClaimedAt` se ainda nulo -
   * usado no cadastro (a propria pessoa acabou de escolher a senha, entao ja
   * conta como "provada") e na redefinicao via token de e-mail (provou o
   * controle da caixa de entrada, equivalente). No login comum a marca so
   * acontece separadamente, apos a senha bater (ver `markPasswordClaimed`).
   */
  setPassword(userId: string, passwordHash: string, claim: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(claim ? { passwordClaimedAt: new Date() } : {}),
      },
    });
  },

  /** Remove a senha (usada quando o auto-link do Google invalida uma senha nunca comprovada - risco R1). */
  clearPassword(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null, passwordClaimedAt: null },
    });
  },

  markEmailVerified(userId: string): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  },

  /** Primeiro login por senha bem-sucedido: so grava se ainda nao havia marca. */
  async markPasswordClaimed(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, passwordClaimedAt: null },
      data: { passwordClaimedAt: new Date() },
    });
  },

  async recordFailedLogin(
    userId: string,
    lockThreshold: number,
    lockDurationMs: number,
  ): Promise<{ attempts: number; lockedUntil: Date | null }> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (user.failedLoginAttempts < lockThreshold) {
      return { attempts: user.failedLoginAttempts, lockedUntil: null };
    }

    const lockedUntil = new Date(Date.now() + lockDurationMs);

    await prisma.user.update({ where: { id: userId }, data: { lockedUntil } });

    return { attempts: user.failedLoginAttempts, lockedUntil };
  },

  async resetFailedLogins(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
