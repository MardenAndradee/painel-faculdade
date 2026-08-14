import type { AppModule } from '@painel/shared';
import { prisma } from '../config/prisma.js';

/** Acesso a dados de Módulos Configuráveis (Etapa 29). */
export const moduleSettingsRepository = {
  findAllByUserId(userId: string): Promise<{ module: AppModule; enabled: boolean }[]> {
    return prisma.userModuleSetting.findMany({
      where: { userId },
      select: { module: true, enabled: true },
    });
  },

  /** Upsert em lote - usado tanto na ativação simples quanto na cascata de dependências. */
  async upsertMany(userId: string, modules: AppModule[], enabled: boolean): Promise<void> {
    if (modules.length === 0) return;

    await prisma.$transaction(
      modules.map((module) =>
        prisma.userModuleSetting.upsert({
          where: { userId_module: { userId, module } },
          create: { userId, module, enabled },
          update: { enabled },
        }),
      ),
    );
  },
};
