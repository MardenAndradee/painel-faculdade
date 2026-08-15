import { prisma } from '../config/prisma.js';
import type { AuthIdentity, AuthProvider } from '../generated/prisma/client.js';

/**
 * Acesso a dados de identidades de terceiro vinculadas a um usuario
 * (Etapa 26 - autenticacao e-mail+senha).
 *
 * A chave de busca e sempre `provider` + `providerAccountId` (o `sub` do
 * Google), nunca o e-mail - ver o comentario no schema Prisma.
 */
export const authIdentityRepository = {
  findByProviderAccount(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<AuthIdentity | null> {
    return prisma.authIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
  },

  findByUserAndProvider(userId: string, provider: AuthProvider): Promise<AuthIdentity | null> {
    return prisma.authIdentity.findUnique({
      where: { userId_provider: { userId, provider } },
    });
  },

  findAllByUser(userId: string): Promise<AuthIdentity[]> {
    return prisma.authIdentity.findMany({ where: { userId } });
  },

  create(userId: string, provider: AuthProvider, providerAccountId: string): Promise<AuthIdentity> {
    return prisma.authIdentity.create({ data: { userId, provider, providerAccountId } });
  },

  async deleteByUserAndProvider(userId: string, provider: AuthProvider): Promise<boolean> {
    const result = await prisma.authIdentity.deleteMany({ where: { userId, provider } });

    return result.count > 0;
  },
};
