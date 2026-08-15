import { z } from 'zod';
import { AUTH_PROVIDER, THEME_PREFERENCE } from '../enums.js';

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

// --- Autenticacao por e-mail e senha (Etapa 26) -------------------------------

/**
 * Politica de senha: so comprimento, sem regra de complexidade artificial.
 *
 * Orientacao atual do NIST (SP 800-63B): exigir maiuscula+numero+simbolo
 * empurra o usuario para padroes previsiveis ("Senha123!") sem ganho real de
 * seguranca; comprimento minimo protege mais e incomoda menos.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const emailField = z
  .string({ error: 'Informe o e-mail' })
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail')
  .email('E-mail inválido');

/** Usada nos formularios de CRIACAO de senha (cadastro, definir, redefinir). */
const newPasswordField = z
  .string({ error: 'Informe a senha' })
  .min(PASSWORD_MIN_LENGTH, `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, 'Senha muito longa');

/**
 * Usada para CONFERIR uma senha ja existente (login, senha atual na troca).
 *
 * Sem `.min(PASSWORD_MIN_LENGTH)`: se a politica mudar no futuro, uma conta
 * antiga com senha mais curta que o novo minimo ainda precisa conseguir
 * entrar - so o CADASTRO de senha nova segue a regra vigente.
 */
const existingPasswordField = z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha');

export const registerSchema = z.object({
  name: z
    .string({ error: 'Informe o nome' })
    .trim()
    .min(2, 'Nome muito curto')
    .max(120, 'Nome muito longo'),
  email: emailField,
  password: newPasswordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: existingPasswordField,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  password: newPasswordField,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Adiciona senha a uma conta que hoje so entra pelo Google. */
export const setPasswordSchema = z.object({
  password: newPasswordField,
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: existingPasswordField,
  newPassword: newPasswordField,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Metodos de login da conta (Configuracoes -> Conta, Etapa 26).
 *
 * `emailVerified` decide se a conta e candidata ao auto-link automatico de um
 * Google com o mesmo e-mail (ver docs/modules/autenticacao.md, risco R1).
 */
export const loginMethodsSchema = z.object({
  hasPassword: z.boolean(),
  emailVerified: z.boolean(),
  linkedProviders: z.array(z.enum(AUTH_PROVIDER)),
});

export type LoginMethods = z.infer<typeof loginMethodsSchema>;

/** URL de consentimento para iniciar o vinculo/login com um provedor (mesmo formato do login inicial). */
export const oauthStartSchema = z.object({
  url: z.string(),
});

export type OAuthStart = z.infer<typeof oauthStartSchema>;
