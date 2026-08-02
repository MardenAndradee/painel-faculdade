import { prisma } from '../config/prisma.js';
import type { User } from '../generated/prisma/client.js';

/**
 * Acesso a dados de usuario.
 *
 * Unica camada autorizada a falar com o Prisma. Services dependem apenas
 * destas funcoes, o que permite trocar a persistencia sem tocar na regra
 * de negocio.
 */

export interface GoogleIdentity {
  googleId: string;
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

  findByGoogleId(googleId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { googleId } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  /**
   * Cria ou atualiza o usuario a partir da identidade do Google.
   *
   * A chave e o `googleId` e nao o e-mail: o Google permite trocar o endereco
   * de uma conta, e usar o e-mail como identidade faria o usuario perder o
   * historico apos essa troca.
   */
  upsertFromGoogle(identity: GoogleIdentity): Promise<User> {
    return prisma.user.upsert({
      where: { googleId: identity.googleId },
      update: {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        lastLogin: new Date(),
      },
      create: {
        googleId: identity.googleId,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
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
};
