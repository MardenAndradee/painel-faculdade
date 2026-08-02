import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracao do Prisma CLI (migrate, seed, studio).
 *
 * A partir do Prisma 7 a URL de conexao sai do schema.prisma e passa a viver
 * aqui: o schema descreve apenas a estrutura, e a conexao vira responsabilidade
 * da aplicacao (via driver adapter) e do CLI (via este arquivo).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
