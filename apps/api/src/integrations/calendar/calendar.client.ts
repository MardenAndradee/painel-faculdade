import { OAuth2Client } from 'google-auth-library';
import { ERROR_CODES } from '@painel/shared';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/app-error.js';
import type { GoogleCalendarClient, GoogleCalendarEvent } from './calendar.types.js';
import type { GoogleTokens, RefreshedTokens } from '../classroom/classroom.client.js';

/**
 * Cliente do Google Calendar.
 *
 * Le apenas o calendario principal (`primary`). Uma conta Google costuma ter
 * agendas de feriados, aniversarios e assinaturas publicas - importar todas
 * encheria o painel com centenas de itens irrelevantes.
 */

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

const MAX_PAGES = 10;
const PAGE_SIZE = 250;

export class GoogleCalendarApiClient implements GoogleCalendarClient {
  private readonly oauth: OAuth2Client;
  private refreshed: RefreshedTokens | null = null;

  constructor(tokens: GoogleTokens) {
    if (!tokens.refreshToken && !tokens.accessToken) {
      throw new AppError(
        'Conta Google não conectada ao Calendar',
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

    this.oauth.on('tokens', (credentials) => {
      if (credentials.access_token) {
        this.refreshed = {
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        };
      }
    });
  }

  getRefreshedTokens(): RefreshedTokens | null {
    return this.refreshed;
  }

  /**
   * Eventos do calendario principal no intervalo.
   *
   * `singleEvents=true` e essencial: sem ele, um evento recorrente ("aula toda
   * terca") viria como UMA entrada com regra de recorrencia, e apareceria uma
   * unica vez no calendario. Com a flag, o Google expande em instancias, cada
   * uma com id proprio - o que tambem resolve a deduplicacao.
   *
   * `showDeleted=true` traz os cancelados, que o service usa para remover do
   * banco o que foi apagado no Google.
   */
  async listEvents(from: Date, to: Date): Promise<GoogleCalendarEvent[]> {
    const results: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let pages = 0;

    do {
      const url = new URL(`${BASE_URL}/calendars/primary/events`);
      url.searchParams.set('timeMin', from.toISOString());
      url.searchParams.set('timeMax', to.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('showDeleted', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', String(PAGE_SIZE));

      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const payload = (await this.request(url.toString())) as {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
      };

      results.push(...(payload.items ?? []));
      pageToken = payload.nextPageToken;
      pages += 1;
    } while (pageToken && pages < MAX_PAGES);

    return results;
  }

  private async request(url: string): Promise<unknown> {
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

    if (response.ok) return response.json();

    const body = await response.text();
    logger.warn('Calendar respondeu com erro', { status: response.status, body });

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'Acesso ao Google Calendar expirou ou foi revogado. Reconecte sua conta.',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    if (response.status === 429) {
      throw new AppError(
        'O Google limitou as requisições. Tente novamente em alguns minutos.',
        429,
        ERROR_CODES.RATE_LIMITED,
      );
    }

    throw new AppError('Falha ao consultar o Google Calendar', 502, ERROR_CODES.GOOGLE_SYNC_ERROR);
  }
}
