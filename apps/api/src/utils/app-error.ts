import { ERROR_CODES, type ErrorCode } from '@painel/shared';

/**
 * Erro de negocio previsivel.
 *
 * Services lancam AppError; o error handler global o traduz em resposta HTTP.
 * Qualquer excecao que NAO seja AppError e tratada como falha inesperada e vira
 * 500 com mensagem generica, sem vazar detalhes internos ao cliente.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode = 400,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, string[]>): AppError {
    return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Nao autenticado'): AppError {
    return new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);
  }

  static forbidden(message = 'Acesso negado'): AppError {
    return new AppError(message, 403, ERROR_CODES.FORBIDDEN);
  }

  static notFound(resource = 'Recurso'): AppError {
    return new AppError(`${resource} nao encontrado`, 404, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, ERROR_CODES.CONFLICT);
  }

  static internal(message = 'Erro interno do servidor'): AppError {
    return new AppError(message, 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
