import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AccessTokenPayload, RefreshTokenPayload } from '@painel/shared';
import { env } from '../config/env.js';
import { AppError } from './app-error.js';
import { ERROR_CODES } from '@painel/shared';

/**
 * Emissao e verificacao dos JWTs.
 *
 * Access e refresh usam segredos DIFERENTES: assim um access token nunca pode
 * ser apresentado no lugar de um refresh token, mesmo que o payload seja
 * forjado. O campo `type` reforca a separacao em tempo de verificacao.
 */

const ISSUER = 'painel-faculdade';

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: ISSUER,
  } as SignOptions);
}

/** O `jti` aponta para o registro em RefreshToken, permitindo revogacao. */
export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ sub: userId, jti: tokenId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: ISSUER,
  } as SignOptions);
}

function translateJwtError(error: unknown): AppError {
  if (error instanceof jwt.TokenExpiredError) {
    return new AppError('Sessao expirada', 401, ERROR_CODES.EXPIRED_TOKEN);
  }

  return new AppError('Token invalido', 401, ERROR_CODES.INVALID_TOKEN);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });

    if (typeof payload === 'string' || payload.type !== 'access') {
      throw new AppError('Token invalido', 401, ERROR_CODES.INVALID_TOKEN);
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw translateJwtError(error);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: ISSUER });

    if (typeof payload === 'string' || payload.type !== 'refresh') {
      throw new AppError('Token invalido', 401, ERROR_CODES.INVALID_TOKEN);
    }

    return payload as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw translateJwtError(error);
  }
}

/**
 * Converte duracoes no formato do jsonwebtoken ("15m", "7d") em segundos.
 * O frontend usa esse valor para renovar o access token antes de expirar.
 */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());

  if (!match) {
    const asNumber = Number(duration);
    if (Number.isFinite(asNumber)) return asNumber;
    throw new Error(`Duracao invalida: ${duration}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

  return amount * (multipliers[unit as string] ?? 1);
}
