import type { Request, Response } from 'express';
import { ERROR_CODES } from '@painel/shared';

/** Ultimo middleware da cadeia: qualquer rota nao registrada cai aqui. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Rota nao encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}
