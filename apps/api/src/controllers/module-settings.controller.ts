import type { Request, Response } from 'express';
import type { AppModule, UpdateModuleSettingInput } from '@painel/shared';
import { moduleSettingsService } from '../services/module-settings.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP de Módulos Configuráveis (Etapa 29). */
export const moduleSettingsController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await moduleSettingsService.list(user.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const module = req.params.module as AppModule;
    const { enabled } = req.body as UpdateModuleSettingInput;

    ok(res, await moduleSettingsService.update(user.id, module, enabled));
  },
};
