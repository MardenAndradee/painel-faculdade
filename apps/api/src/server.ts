import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';

/**
 * Bootstrap do processo: valida ambiente, conecta ao banco, sobe o servidor e
 * registra o desligamento gracioso (drena conexoes antes de sair).
 */
async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API no ar em http://localhost:${env.PORT}/api/v1`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info(`Sinal ${signal} recebido, encerrando...`);

    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });

    // Se as conexoes nao drenarem em 10s, forca a saida.
    setTimeout(() => {
      logger.error('Encerramento forcado apos timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Falha ao iniciar a API: ${message}`);
  process.exit(1);
});
