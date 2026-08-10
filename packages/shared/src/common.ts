import { z } from 'zod';

/**
 * Blocos reutilizados por todos os modulos: identificadores, paginacao e o
 * formato das respostas da API. Definidos uma unica vez para que backend e
 * frontend nunca divirjam sobre o formato do payload.
 */

export const cuidSchema = z.string().min(1, 'Identificador obrigatorio');

/** "2026-10-05" - o formato do input `date`, sem hora nem fuso. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpreta o que um formulario digitou como horario LOCAL.
 *
 * O JavaScript trata "2026-10-05" como meia-noite UTC e "2026-10-05T00:00"
 * como meia-noite local - regra da especificacao, e a origem de um bug real:
 * uma prova cadastrada para 05/10 era gravada as 00:00Z e exibida como 04/10
 * no calendario, porque no horario de Brasilia isso e 21h do dia anterior.
 *
 * Acrescentar a hora explicita alinha os dois casos com o que a pessoa
 * digitou. Strings que ja trazem hora (`datetime-local`) passam direto: o
 * JavaScript ja as le como locais.
 */
export function parseLocalDate(value: string): Date {
  return new Date(DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value);
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Boolean vindo de query string.
 *
 * NAO use `z.coerce.boolean()` aqui: ele aplica `Boolean(valor)`, e como
 * qualquer string nao vazia e verdadeira, `"false"` viraria `true`. Em uma
 * flag como `?permanent=false` isso significaria apagar dados que deveriam
 * apenas ser arquivados.
 */
export function booleanQueryParam(defaultValue = false) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      if (typeof value === 'boolean') return value;

      return value === 'true' || value === '1';
    });
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Envelope de sucesso devolvido por toda rota da API. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Envelope de erro devolvido pelo error handler global. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    /** Preenchido apenas em falhas de validacao: campo -> mensagens. */
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Codigos de erro estaveis, consumidos pelo frontend para reagir a falhas. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  GOOGLE_SYNC_ERROR: 'GOOGLE_SYNC_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function buildPaginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0;

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
