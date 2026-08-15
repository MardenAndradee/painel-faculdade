import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Protege rotas de cron (Etapa 28.11 - disparo de push).
 *
 * A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente nas
 * chamadas originadas por `vercel.json`'s `crons` quando essa variavel esta
 * configurada no projeto - o mesmo header que `authenticate` usa, mas
 * comparado contra um segredo compartilhado em vez de um JWT de usuario.
 */
export function cronAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!env.CRON_SECRET) {
    next(AppError.internal('CRON_SECRET não configurado'));
    return;
  }

  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    next(AppError.unauthorized('Cron não autorizado'));
    return;
  }

  next();
}
