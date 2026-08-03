import type { AutoSyncResult } from '@painel/shared';
import {
  ERROR_CODES,
  GOOGLE_SCOPE_GROUPS,
  type CalendarSyncReport,
  type IntegrationStatus,
  type SyncReport,
} from '@painel/shared';
import { prisma } from '../config/prisma.js';
import { GoogleClassroomClient } from '../integrations/classroom/classroom.client.js';
import { GoogleCalendarApiClient } from '../integrations/calendar/calendar.client.js';
import { classroomSyncService } from './classroom-sync.service.js';
import { calendarSyncService } from './calendar-sync.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';

/**
 * Intervalo minimo entre sincronizacoes automaticas.
 *
 * Trinta minutos e maior que uma navegacao normal - entao abrir e fechar o app
 * varias vezes nao dispara nada - e menor que uma aula, entao uma atividade
 * postada de manha aparece antes da tarde.
 */
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Orquestracao das integracoes com o Google.
 *
 * Cuida do que envolve credenciais e estado da conexao; a importacao em si
 * fica em `classroom-sync.service`, que nao conhece OAuth.
 */

/** Escopos concedidos ficam registrados para saber o que ja foi autorizado. */
function hasScopes(granted: string[] | null, group: keyof typeof GOOGLE_SCOPE_GROUPS): boolean {
  if (!granted?.length) return false;

  const required = GOOGLE_SCOPE_GROUPS[group];

  // Basta um escopo do grupo: o Google pode conceder um subconjunto, e mesmo
  // parcial ja permite parte da sincronizacao.
  return required.some((scope) => granted.includes(scope));
}

export const integrationService = {
  async getStatus(userId: string): Promise<IntegrationStatus> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuário');

    const [importedSubjects, importedAssignments] = await prisma.$transaction([
      prisma.subject.count({ where: { userId, googleCourseId: { not: null } } }),
      prisma.assignment.count({ where: { userId, source: 'GOOGLE_CLASSROOM' } }),
    ]);

    const granted = user.googleGrantedScopes;

    return {
      googleConnected: Boolean(user.googleId),
      classroomConnected: hasScopes(granted, 'classroom'),
      calendarConnected: hasScopes(granted, 'calendar'),
      classroomSyncedAt: user.classroomSyncedAt?.toISOString() ?? null,
      calendarSyncedAt: user.calendarSyncedAt?.toISOString() ?? null,
      importedSubjects,
      importedAssignments,
    };
  },

  /**
   * Dispara a sincronizacao do Classroom.
   *
   * Monta o cliente com os tokens do usuario e persiste o access token
   * renovado, se a biblioteca tiver renovado durante as chamadas.
   */
  async syncClassroom(userId: string): Promise<SyncReport> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuário');

    if (!user.googleRefreshToken && !user.googleAccessToken) {
      throw new AppError(
        'Conecte sua conta ao Google Classroom antes de sincronizar',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    if (!hasScopes(user.googleGrantedScopes, 'classroom')) {
      throw new AppError(
        'Permissão do Google Classroom não concedida. Conecte a integração.',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    const client = new GoogleClassroomClient({
      accessToken: user.googleAccessToken,
      refreshToken: user.googleRefreshToken,
      expiryDate: user.googleTokenExpiry,
    });

    try {
      const report = await classroomSyncService.sync(userId, client);

      const refreshed = client.getRefreshedTokens();

      if (refreshed) {
        await userRepository.updateGoogleTokens(userId, {
          googleAccessToken: refreshed.accessToken,
          googleRefreshToken: null,
          googleTokenExpiry: refreshed.expiryDate,
        });
      }

      return report;
    } catch (error) {
      logger.error('Falha na sincronizacao do Classroom', {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },

  /**
   * Dispara a sincronizacao do Google Calendar.
   *
   * Mesma estrutura da do Classroom: monta o cliente, sincroniza e persiste o
   * access token renovado.
   */
  async syncCalendar(userId: string): Promise<CalendarSyncReport> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuário');

    if (!hasScopes(user.googleGrantedScopes, 'calendar')) {
      throw new AppError(
        'Permissão do Google Calendar não concedida. Conecte a integração.',
        403,
        ERROR_CODES.GOOGLE_SYNC_ERROR,
      );
    }

    const client = new GoogleCalendarApiClient({
      accessToken: user.googleAccessToken,
      refreshToken: user.googleRefreshToken,
      expiryDate: user.googleTokenExpiry,
    });

    try {
      const report = await calendarSyncService.sync(userId, client);

      const refreshed = client.getRefreshedTokens();

      if (refreshed) {
        await userRepository.updateGoogleTokens(userId, {
          googleAccessToken: refreshed.accessToken,
          googleRefreshToken: null,
          googleTokenExpiry: refreshed.expiryDate,
        });
      }

      return report;
    } catch (error) {
      logger.error('Falha na sincronizacao do Calendar', {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },

  /**
   * Desconecta o Calendar.
   *
   * Os eventos ja importados sao REMOVIDOS: sem a integracao ativa eles nunca
   * mais seriam atualizados, e manter copias congeladas da agenda do Google
   * confundiria mais do que ajudaria. Eventos criados no Painel permanecem.
   */
  async disconnectCalendar(userId: string): Promise<{ removedEvents: number }> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuário');

    const removed = await prisma.calendarEvent.deleteMany({
      where: { userId, source: 'GOOGLE_CALENDAR' },
    });

    const remaining = (user.googleGrantedScopes ?? []).filter(
      (scope) => !GOOGLE_SCOPE_GROUPS.calendar.includes(scope as never),
    );

    await prisma.user.update({
      where: { id: userId },
      data: { googleGrantedScopes: remaining, calendarSyncedAt: null },
    });

    return { removedEvents: removed.count };
  },

  /** Desconecta a integracao: os dados ja importados permanecem. */
  async disconnectClassroom(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) throw AppError.notFound('Usuário');

    const remaining = (user.googleGrantedScopes ?? []).filter(
      (scope) => !GOOGLE_SCOPE_GROUPS.classroom.includes(scope as never),
    );

    await prisma.user.update({
      where: { id: userId },
      data: { googleGrantedScopes: remaining, classroomSyncedAt: null },
    });
  },

  /**
   * Sincronizacao automatica, disparada quando o usuario abre o app.
   *
   * A decisao de sincronizar ou nao e do SERVIDOR, nao do cliente. Se o
   * navegador decidisse, uma aba recarregando em laco esgotaria a cota da
   * conta Google do usuario - o teto viraria sugestao. Aqui o cliente apenas
   * avisa que abriu; quem consulta o relogio e quem manda e este metodo.
   *
   * Nao lanca: uma falha de rede ao abrir a tela nao pode virar erro na cara
   * de quem so queria ver o dashboard. O botao manual em Integracoes continua
   * sendo o caminho para ver o relatorio completo e os avisos.
   */
  async autoSyncClassroom(userId: string): Promise<AutoSyncResult> {
    const empty = { subjects: 0, assignments: 0 };

    const user = await userRepository.findById(userId);

    if (!user || !hasScopes(user.googleGrantedScopes, 'classroom')) {
      return { ran: false, skippedReason: 'nao-conectado', imported: empty, syncedAt: null };
    }

    const lastSync = user.classroomSyncedAt;

    if (lastSync && Date.now() - lastSync.getTime() < AUTO_SYNC_INTERVAL_MS) {
      return {
        ran: false,
        skippedReason: 'sincronizado-recentemente',
        imported: empty,
        syncedAt: lastSync.toISOString(),
      };
    }

    try {
      const report = await this.syncClassroom(userId);

      return {
        ran: true,
        skippedReason: null,
        // So o que ENTROU interessa aqui: o usuario nao pediu esta
        // sincronizacao, entao avisar sobre atualizacoes de rotina seria ruido.
        imported: {
          subjects: report.subjects.created,
          assignments: report.assignments.created,
        },
        syncedAt: report.finishedAt,
      };
    } catch (error) {
      logger.warn('Sincronizacao automatica do Classroom falhou', {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });

      return { ran: false, skippedReason: null, imported: empty, syncedAt: null };
    }
  },
};
