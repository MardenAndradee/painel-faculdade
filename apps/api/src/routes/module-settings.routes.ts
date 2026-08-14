import { Router } from 'express';
import { moduleParamSchema, updateModuleSettingSchema } from '@painel/shared';
import { moduleSettingsController } from '../controllers/module-settings.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';

/** Rotas de Módulos Configuráveis (Etapa 29). Todas exigem sessão ativa. */
export const moduleSettingsRoutes: Router = Router();

moduleSettingsRoutes.use(authenticate);

moduleSettingsRoutes.get('/module-settings', moduleSettingsController.list);

moduleSettingsRoutes.patch(
  '/module-settings/:module',
  validate({ params: moduleParamSchema, body: updateModuleSettingSchema }),
  moduleSettingsController.update,
);
