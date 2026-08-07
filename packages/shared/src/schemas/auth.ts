import { z } from 'zod';
import { THEME_PREFERENCE } from '../enums.js';

/**
 * Contrato de autenticacao compartilhado entre API e frontend.
 *
 * O backend valida as respostas contra estes schemas e o frontend deriva seus
 * tipos deles: se o formato do usuario mudar aqui, os dois lados quebram no
 * mesmo lugar, em tempo de compilacao.
 */

/** Usuario autenticado, tal como exposto pela API. Nunca inclui tokens. */
export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  theme: z.enum(THEME_PREFERENCE),
  timezone: z.string(),
  locale: z.string(),
  createdAt: z.string(),
  /** Indica se o usuario ja concedeu escopos do Google Classroom (Etapa 8). */
  hasClassroomAccess: z.boolean(),
  /** Indica se o usuario ja concedeu escopos do Google Calendar (Etapa 9). */
  hasCalendarAccess: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Resposta de login e de refresh.
 *
 * O refresh token nao aparece aqui de proposito: ele trafega apenas no cookie
 * httpOnly, fora do alcance do JavaScript.
 */
export const authSessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  /** Validade do access token em segundos, usada para renovacao proativa. */
  expiresIn: z.number().int().positive(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

/**
 * Troca do token emitido no callback do Google pela sessao (e pelo cookie).
 *
 * O callback NAO grava mais o cookie na mesma resposta que redireciona: o
 * Safari (ITP) limita a validade de cookies gravados numa resposta de
 * redirecionamento logo apos uma navegacao vinda de outro site, ignorando o
 * `maxAge` configurado. O token viaja no fragmento da URL (nunca chega ao
 * servidor) e esta rota o troca pela sessao via um `fetch` comum - fora de
 * qualquer cadeia de redirecionamento, o cookie e gravado com a validade certa.
 */
export const exchangeSessionSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
});

export type ExchangeSessionInput = z.infer<typeof exchangeSessionSchema>;

/** Conteudo do access token JWT. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
  iat: number;
  exp: number;
}

/** Conteudo do refresh token JWT. */
export interface RefreshTokenPayload {
  sub: string;
  /** Identificador do registro em RefreshToken, usado para rotacao. */
  jti: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

/** Preferencias editaveis pelo proprio usuario. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120, 'Nome muito longo').optional(),
  theme: z.enum(THEME_PREFERENCE).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Escopos adicionais solicitados de forma incremental nas Etapas 8 e 9. */
export const GOOGLE_SCOPE_GROUPS = {
  classroom: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  ],
  /**
   * Somente leitura, deliberadamente.
   *
   * `calendar.events` daria permissao de ESCRITA na agenda pessoal do usuario.
   * O Painel apenas importa eventos; pedir permissao que nao se usa e ma
   * pratica e reduz a confianca na tela de consentimento.
   */
  calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
} as const;

export type GoogleScopeGroup = keyof typeof GOOGLE_SCOPE_GROUPS;
