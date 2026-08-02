import { OAuth2Client } from 'google-auth-library';
import { ERROR_CODES } from '@painel/shared';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/app-error.js';
import type {
  ClassroomClient,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomSubmission,
  ClassroomTeacher,
} from './classroom.types.js';

/**
 * Cliente HTTP do Google Classroom.
 *
 * Usa `fetch` direto na REST API em vez do pacote `googleapis`, que traria os
 * tipos de todas as APIs do Google para consumirmos quatro endpoints.
 * O `google-auth-library` cuida apenas de obter e renovar o access token.
 */

const BASE_URL = 'https://classroom.googleapis.com/v1';

/** Tetos de seguranca: um usuario legitimo nunca chega perto disso. */
const MAX_PAGES = 10;
const PAGE_SIZE = 50;

export interface GoogleTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: Date | null;
}

/** Tokens renovados durante a chamada, para o service persistir. */
export interface RefreshedTokens {
  accessToken: string;
  expiryDate: Date | null;
}

export class GoogleClassroomClient implements ClassroomClient {
  private readonly oauth: OAuth2Client;
  private refreshed: RefreshedTokens | null = null;

  constructor(tokens: GoogleTokens) {
    if (!tokens.refreshToken && !tokens.accessToken) {
      throw new AppError(
        'Conta Google não conectada ao Classroom',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    this.oauth = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    });

    this.oauth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate?.getTime() ?? null,
    });

    // A biblioteca renova sozinha quando o token expira; guardamos o novo par
    // para que o service atualize o banco e a proxima sync ja comece valida.
    this.oauth.on('tokens', (credentials) => {
      if (credentials.access_token) {
        this.refreshed = {
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        };
      }
    });
  }

  /** Tokens renovados nesta sessao, se houve renovacao. */
  getRefreshedTokens(): RefreshedTokens | null {
    return this.refreshed;
  }

  /**
   * Chamada autenticada com paginacao.
   *
   * O Classroom devolve `nextPageToken` enquanto houver mais itens; paramos no
   * teto de paginas para nao entrar em laco caso a API mude de comportamento.
   */
  private async fetchAll<T>(
    path: string,
    listKey: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const results: T[] = [];
    let pageToken: string | undefined;
    let pages = 0;

    do {
      const url = new URL(`${BASE_URL}${path}`);
      url.searchParams.set('pageSize', String(PAGE_SIZE));

      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await this.request(url.toString());
      const payload = response as Record<string, unknown>;
      const items = (payload[listKey] as T[] | undefined) ?? [];

      results.push(...items);
      pageToken = payload.nextPageToken as string | undefined;
      pages += 1;
    } while (pageToken && pages < MAX_PAGES);

    return results;
  }

  private async request(url: string): Promise<unknown> {
    // `getAccessToken` renova automaticamente se o token estiver vencido.
    const { token } = await this.oauth.getAccessToken();

    if (!token) {
      throw new AppError(
        'Não foi possível renovar o acesso ao Google. Reconecte sua conta.',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (response.ok) {
      return response.json();
    }

    const body = await response.text();
    logger.warn('Classroom respondeu com erro', { status: response.status, url, body });

    // 401/403 significam consentimento revogado ou escopo faltando - o
    // usuario precisa reconectar, e nao apenas tentar de novo.
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'Acesso ao Google Classroom expirou ou foi revogado. Reconecte sua conta.',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    if (response.status === 429) {
      throw new AppError(
        'O Google limitou as requisições. Tente sincronizar novamente em alguns minutos.',
        429,
        ERROR_CODES.RATE_LIMITED,
      );
    }

    // 5xx e problema do lado do Google, nao do pedido. Dizer isso poupa o
    // usuario de procurar erro na propria conta - e a acao certa e so tentar
    // de novo mais tarde.
    if (response.status >= 500) {
      throw new AppError(
        'O Google Classroom está instável no momento. Tente novamente em alguns minutos.',
        502,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    throw new AppError(
      `Falha ao consultar o Google Classroom (HTTP ${response.status})`,
      502,
      ERROR_CODES.GOOGLE_SYNC_ERROR,
    );
  }

  /** Turmas em que o usuario e ALUNO. Turmas arquivadas ficam de fora. */
  async listCourses(): Promise<ClassroomCourse[]> {
    const courses = await this.fetchAll<ClassroomCourse>('/courses', 'courses', {
      studentId: 'me',
      courseStates: 'ACTIVE',
    });

    return courses;
  }

  async listTeachers(courseId: string): Promise<ClassroomTeacher[]> {
    return this.fetchAll<ClassroomTeacher>(`/courses/${courseId}/teachers`, 'teachers');
  }

  async listCourseWork(courseId: string): Promise<ClassroomCourseWork[]> {
    return this.fetchAll<ClassroomCourseWork>(`/courses/${courseId}/courseWork`, 'courseWork');
  }

  /** Entregas do proprio aluno: revela o que ja foi entregue. */
  async listSubmissions(courseId: string): Promise<ClassroomSubmission[]> {
    return this.fetchAll<ClassroomSubmission>(
      `/courses/${courseId}/courseWork/-/studentSubmissions`,
      'studentSubmissions',
      { userId: 'me' },
    );
  }
}
