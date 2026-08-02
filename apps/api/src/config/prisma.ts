import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Ponto unico de acesso ao Prisma.
 *
 * O client do Prisma 7 e gerado em `src/generated/prisma`. Todo o restante do
 * backend importa daqui - assim o caminho do codigo gerado nao se espalha e
 * uma futura mudanca de output afeta apenas este arquivo.
 *
 * A conexao usa driver adapter (node-postgres): desde o Prisma 7 a URL nao vem
 * mais do schema, e passada na construcao do client.
 *
 * O cache no globalThis existe porque em desenvolvimento o tsx recarrega os
 * modulos a cada alteracao; sem ele cada reload abriria um novo pool de
 * conexoes ate esgotar o limite do Postgres.
 */

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientInstance };

function createPrismaClient(): PrismaClientInstance {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClientInstance = globalForPrisma.prisma ?? createPrismaClient();

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Conexao com o banco de dados estabelecida');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Conexao com o banco de dados encerrada');
}

/** Namespace do Prisma (tipos de input, erros, helpers) reexportado. */
export { Prisma };
export type { PrismaClientInstance };
