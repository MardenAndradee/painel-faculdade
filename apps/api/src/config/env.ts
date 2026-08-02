import 'dotenv/config';
import { z } from 'zod';

/**
 * Validacao das variaveis de ambiente no boot (fail-fast).
 *
 * Se algo estiver faltando ou malformado o processo morre imediatamente com
 * uma mensagem legivel, em vez de falhar em producao na primeira requisicao
 * que tocar a variavel ausente. A partir daqui `env` e totalmente tipado.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa de ao menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET precisa de ao menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3333/api/v1/auth/google/callback'),

  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Variaveis de ambiente invalidas:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  /** CORS_ORIGINS aceita multiplas origens separadas por virgula. */
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxUploadSizeBytes: raw.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
} as const;

export type Env = typeof env;
