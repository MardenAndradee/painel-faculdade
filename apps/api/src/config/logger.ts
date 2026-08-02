import { env } from './env.js';

/**
 * Logger minimo sem dependencia externa.
 *
 * Em desenvolvimento imprime linhas legiveis; em producao imprime JSON, que e
 * o formato que agregadores (CloudWatch, Loki, Datadog) conseguem indexar.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;

type LogContext = Record<string, unknown>;

const threshold = LEVELS[env.LOG_LEVEL];

function write(level: Level, message: string, context?: LogContext): void {
  if (LEVELS[level] < threshold) return;

  const timestamp = new Date().toISOString();

  if (env.isProduction) {
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({ level, timestamp, message, ...context }),
    );
    return;
  }

  const suffix = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  console[level === 'debug' ? 'log' : level](
    `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${suffix}`,
  );
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};
