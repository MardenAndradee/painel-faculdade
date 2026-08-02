import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiErrorResponse } from '@painel/shared';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { Prisma } from '../config/prisma.js';

/**
 * Tratamento global de erros - unico ponto do backend que constroi resposta de
 * falha. Como rodamos Express 5, promises rejeitadas em handlers async chegam
 * aqui automaticamente, sem necessidade de wrapper try/catch nos controllers.
 */

/** Converte o ZodError no mapa `campo -> mensagens` esperado pelo frontend. */
function formatZodIssues(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    details[path] = [...(details[path] ?? []), issue.message];
  }

  return details;
}

function buildResponse(
  code: string,
  message: string,
  details?: Record<string, string[]>,
): ApiErrorResponse {
  return { success: false, error: details ? { code, message, details } : { code, message } };
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // A assinatura de 4 parametros e o que identifica um error handler no Express.
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    logger.warn('Erro de negocio', {
      code: error.code,
      message: error.message,
      path: req.originalUrl,
    });
    res.status(error.statusCode).json(buildResponse(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    res
      .status(400)
      .json(buildResponse(ERROR_CODES.VALIDATION_ERROR, 'Dados invalidos', formatZodIssues(error)));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: violacao de constraint unica. P2025: registro nao encontrado.
    if (error.code === 'P2002') {
      const fields = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'registro';
      res
        .status(409)
        .json(buildResponse(ERROR_CODES.CONFLICT, `Ja existe um registro com este ${fields}`));
      return;
    }

    if (error.code === 'P2025') {
      res.status(404).json(buildResponse(ERROR_CODES.NOT_FOUND, 'Recurso nao encontrado'));
      return;
    }

    if (error.code === 'P2003') {
      res
        .status(400)
        .json(buildResponse(ERROR_CODES.VALIDATION_ERROR, 'Referencia invalida entre registros'));
      return;
    }
  }

  const message = error instanceof Error ? error.message : 'Erro desconhecido';
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error('Erro nao tratado', { message, stack, path: req.originalUrl, method: req.method });

  // Em producao a mensagem real nunca chega ao cliente.
  res
    .status(500)
    .json(
      buildResponse(
        ERROR_CODES.INTERNAL_ERROR,
        env.isProduction ? 'Erro interno do servidor' : message,
      ),
    );
}
