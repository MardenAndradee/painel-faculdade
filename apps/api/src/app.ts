import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { routes } from './routes/index.js';
import { apiRateLimiter } from './middlewares/rate-limit.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';

/**
 * Montagem da aplicacao Express, separada do server.ts para que testes de
 * integracao possam importar o app sem abrir uma porta.
 *
 * A ordem dos middlewares importa: seguranca -> parsing -> rate limit ->
 * rotas -> 404 -> error handler (sempre por ultimo).
 */
export function createApp(): Express {
  const app = express();

  // Necessario para que o rate limiter enxergue o IP real atras de proxy/load balancer.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/v1', apiRateLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
