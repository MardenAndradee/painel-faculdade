import { prisma } from '../config/prisma.js';
import type { EmailToken, EmailTokenPurpose } from '../generated/prisma/client.js';

/**
 * Acesso a dados dos tokens de e-mail (Etapa 26): verificacao de cadastro e
 * recuperacao de senha. So o hash SHA-256 e persistido - mesmo padrao de
 * `RefreshToken`.
 */
export interface CreateEmailTokenData {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}

export const emailTokenRepository = {
  create(data: CreateEmailTokenData): Promise<EmailToken> {
    return prisma.emailToken.create({ data });
  },

  findByHash(tokenHash: string): Promise<EmailToken | null> {
    return prisma.emailToken.findUnique({ where: { tokenHash } });
  },

  markUsed(id: string): Promise<EmailToken> {
    return prisma.emailToken.update({ where: { id }, data: { usedAt: new Date() } });
  },

  /**
   * Invalida os tokens ainda validos de um proposito antes de emitir um novo.
   *
   * Pedir "esqueci minha senha" duas vezes seguidas nao deve deixar dois
   * links validos ao mesmo tempo - o mais antigo e marcado como usado, sem
   * ser de fato consumido, so para tirar de circulacao.
   */
  async invalidatePending(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await prisma.emailToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  },
};
