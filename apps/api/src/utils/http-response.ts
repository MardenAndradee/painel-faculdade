import type { Response } from 'express';
import type { ApiSuccessResponse, PaginatedResult } from '@painel/shared';

/**
 * Helpers que padronizam o envelope de resposta.
 *
 * Todos os controllers respondem por aqui, garantindo que o frontend sempre
 * receba a mesma estrutura `{ success, data, meta? }`.
 */

export function ok<T>(res: Response, data: T): Response<ApiSuccessResponse<T>> {
  return res.status(200).json({ success: true, data });
}

export function created<T>(res: Response, data: T): Response<ApiSuccessResponse<T>> {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated<T>(
  res: Response,
  result: PaginatedResult<T>,
): Response<ApiSuccessResponse<T[]>> {
  return res.status(200).json({ success: true, data: result.data, meta: result.meta });
}
