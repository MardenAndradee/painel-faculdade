import type { Request, Response } from 'express';
import { integrationService } from '../services/integration.service.js';
import { authService } from '../services/auth.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { noContent, ok } from '../utils/http-response.js';
import { setOAuthStateCookie } from '../utils/cookies.js';

/** Camada HTTP das integracoes com o Google. */
export const integrationController = {
  async status(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await integrationService.getStatus(user.id));
  },

  /**
   * URL de autorizacao incremental do Classroom.
   *
   * Devolve a URL em vez de redirecionar: a chamada parte de `fetch`
   * autenticado, e um redirect nesse contexto nao levaria o usuario a lugar
   * nenhum. O frontend navega para a URL recebida.
   */
  connectClassroom(req: Request, res: Response): void {
    getAuthUser(req);

    const { url, state } = authService.buildScopeUpgradeUrl('classroom');

    setOAuthStateCookie(res, state);
    ok(res, { url });
  },

  /**
   * Sincronizacao automatica ao abrir o app.
   *
   * Sempre responde 200, mesmo quando nao sincroniza: "nao rodou porque foi
   * ha 5 minutos" nao e erro, e devolver 4xx faria o cliente tratar como
   * falha algo que e o comportamento correto.
   */
  async autoSyncClassroom(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await integrationService.autoSyncClassroom(user.id));
  },

  async syncClassroom(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await integrationService.syncClassroom(user.id));
  },

  async disconnectClassroom(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await integrationService.disconnectClassroom(user.id);
    noContent(res);
  },

  // --- Google Calendar ---------------------------------------------------------

  connectCalendar(req: Request, res: Response): void {
    getAuthUser(req);

    const { url, state } = authService.buildScopeUpgradeUrl('calendar');

    setOAuthStateCookie(res, state);
    ok(res, { url });
  },

  async syncCalendar(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await integrationService.syncCalendar(user.id));
  },

  async disconnectCalendar(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await integrationService.disconnectCalendar(user.id));
  },
};
