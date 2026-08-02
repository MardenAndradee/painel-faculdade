import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Protege rotas exigindo um access token valido no header Authorization.
 *
 * Apenas verifica a assinatura do JWT - nao consulta o banco. Essa e a razao
 * do access token ser curto (15 min): a revogacao acontece no refresh, e um
 * token vazado deixa de valer rapidamente sem custo de I/O por requisicao.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de acesso nao informado');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw AppError.unauthorized('Token de acesso nao informado');
    }

    const payload = verifyAccessToken(token);

    req.user = { id: payload.sub, email: payload.email };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Recupera o usuario autenticado ja estreitado.
 *
 * Se `req.user` estiver ausente, a rota foi registrada sem o middleware
 * `authenticate` - um erro de programacao, e nao uma falha do cliente.
 */
export function getAuthUser(req: Request): { id: string; email: string } {
  if (!req.user) {
    throw AppError.internal('Rota protegida sem o middleware de autenticacao');
  }

  return req.user;
}
