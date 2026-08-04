import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracao do Prisma CLI (migrate, seed, studio).
 *
 * A partir do Prisma 7 a URL de conexao sai do schema.prisma e passa a viver
 * aqui: o schema descreve apenas a estrutura, e a conexao vira responsabilidade
 * da aplicacao (via driver adapter) e do CLI (via este arquivo).
 *
 * `DIRECT_DATABASE_URL` e opcional e serve para provedores com pooler (Neon,
 * Supabase...): em producao `DATABASE_URL` aponta para a conexao *pooled*
 * (e o que a aplicacao usa em runtime), mas o pooler em modo transacao nao
 * suporta os comandos DDL que `migrate` precisa emitir. Quando ausente (dev
 * local, Postgres sem pooler), cai de volta em `DATABASE_URL`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL || env('DATABASE_URL'),
  },
});
