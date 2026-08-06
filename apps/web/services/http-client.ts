import type { ApiErrorResponse, PaginationMeta } from '@painel/shared';

/**
 * Cliente HTTP da aplicacao.
 *
 * Responsabilidades:
 * - anexar o access token guardado em memoria;
 * - renovar a sessao automaticamente ao receber 401 e repetir a requisicao;
 * - garantir que varias chamadas simultaneas disparem UM unico refresh.
 *
 * O access token e mantido em memoria (nunca em localStorage): qualquer script
 * injetado leria o localStorage, enquanto o escopo deste modulo e inacessivel.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

/** Erro de API com os dados necessarios para a UI reagir. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Mensagem do primeiro campo invalido, util para exibir em formularios. */
  get firstDetail(): string | null {
    if (!this.details) return null;
    const first = Object.values(this.details)[0];
    return first?.[0] ?? null;
  }
}

// --- Estado do token em memoria ---------------------------------------------

let accessToken: string | null = null;
/** Chamado quando a renovacao falha em definitivo (sessao encerrada). */
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

// --- Renovacao ---------------------------------------------------------------

/**
 * Refresh em andamento.
 *
 * Se cinco requisicoes receberem 401 ao mesmo tempo, todas aguardam esta mesma
 * promise. Sem isso, cada uma dispararia seu proprio refresh e a rotacao de
 * tokens invalidaria as demais - derrubando a sessao do usuario.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) return null;

      const body = (await response.json()) as { data?: { accessToken?: string } };
      const token = body.data?.accessToken ?? null;

      accessToken = token;
      return token;
    } catch {
      return null;
    } finally {
      // Liberado apos a resolucao para que o proximo 401 gere um refresh novo.
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Renovacao explicita, usada pelo AuthProvider no carregamento inicial. */
export function refreshSession(): Promise<string | null> {
  return refreshAccessToken();
}

// --- Requisicao ---------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Requisicoes publicas (login, refresh) nao tentam renovar a sessao. */
  skipAuth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Monta a URL final aceitando `API_URL` absoluto OU relativo.
 *
 * Em producao o valor recomendado e relativo (`/api/v1`), servido pelo mesmo
 * dominio do frontend via rewrite. Isso faz o cookie de sessao ser
 * *first-party*: navegadores que bloqueiam cookie de terceiro - Brave por
 * padrao, e o Chrome caminhando para o mesmo - descartariam um cookie vindo de
 * um dominio diferente, e a sessao nunca se estabeleceria.
 *
 * `new URL()` exige base quando o primeiro argumento e relativo, dai o
 * `origin`. Em SSR nao ha `window`; a base ali e irrelevante porque as
 * chamadas partem de hooks que so rodam no cliente.
 */
function buildUrl(path: string, query?: RequestOptions['query']): string {
  const normalized = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

  const url = new URL(normalized, origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorResponse;

    return new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Erro inesperado',
      body.error?.details,
    );
  } catch {
    return new ApiError(response.status, 'UNKNOWN', 'Nao foi possivel contatar o servidor');
  }
}

async function executeRequest(path: string, options: RequestOptions): Promise<Response> {
  const { body, query, skipAuth: _skipAuth, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    finalHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * Envia a requisicao e, em caso de 401, renova a sessao e tenta uma unica vez.
 *
 * Toda variante (JSON, paginada, binaria) passa por aqui: o tratamento de
 * sessao expirada precisa ser identico nas tres, e duplica-lo foi justamente
 * o que levaria uma delas a divergir com o tempo.
 */
async function sendWithRetry(path: string, options: RequestOptions): Promise<Response> {
  const response = await executeRequest(path, options);

  if (response.status !== 401 || options.skipAuth) return response;

  const token = await refreshAccessToken();

  if (!token) {
    accessToken = null;
    onSessionExpired?.();
    throw await parseError(response);
  }

  return executeRequest(path, options);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await sendWithRetry(path, options);

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

/** Variante para listagens paginadas, que precisam do `meta` da resposta. */
async function requestPaginated<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const response = await sendWithRetry(path, options);

  if (!response.ok) throw await parseError(response);

  return (await response.json()) as { data: T[]; meta: PaginationMeta };
}

/**
 * Variante binaria, usada para baixar e pre-visualizar materiais.
 *
 * O download exige o header `Authorization`, e um `<img src>` ou `<iframe src>`
 * nao consegue envia-lo. Por isso buscamos os bytes aqui e o componente monta
 * um object URL local a partir do blob.
 */
async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await sendWithRetry(path, options);

  if (!response.ok) throw await parseError(response);

  return response.blob();
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),

  getPaginated: <T>(path: string, options?: RequestOptions) =>
    requestPaginated<T>(path, { ...options, method: 'GET' }),

  getBlob: (path: string, options?: RequestOptions) =>
    requestBlob(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export { API_URL };
