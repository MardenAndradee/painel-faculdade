import { prisma } from '../config/prisma.js';
import type { RefreshToken } from '../generated/prisma/client.js';

/**
 * Acesso a dados das sessoes ativas.
 *
 * Cada linha representa um refresh token emitido. Guardamos apenas o hash:
 * um vazamento do banco nao permite assumir sessoes.
 */

export interface CreateRefreshTokenData {
  /**
   * Id definido pelo service, e nao pelo banco.
   *
   * O refresh token e assinado com este id (`jti`), e o hash gravado aqui e o
   * hash desse token ja assinado. Definir o id antecipadamente permite criar a
   * linha em uma unica escrita, em vez de inserir e depois atualizar o hash.
   */
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

export const refreshTokenRepository = {
  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  },

  findById(id: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { id } });
  },

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke(id: string): Promise<RefreshToken> {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * Revoga todas as sessoes do usuario.
   *
   * Acionado quando um refresh token ja usado reaparece - sinal de token
   * roubado. Derrubar tudo forca um novo login por um caminho confiavel.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  },

  /** Remove tokens expirados ou revogados ha mais de 30 dias. */
  async deleteExpired(): Promise<number> {
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: threshold } }],
      },
    });

    return result.count;
  },
};
