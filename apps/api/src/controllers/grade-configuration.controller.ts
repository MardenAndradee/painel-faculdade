import type { Request, Response } from 'express';
import { gradeConfigurationService } from '../services/grade-configuration.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { ok } from '../utils/http-response.js';

/** Camada HTTP de configuracao de notas (Etapa 17). */
export const gradeConfigurationController = {
  async getForSubject(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await gradeConfigurationService.getForSubject(user.id, req.params.id as string));
  },

  async replaceForSubject(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await gradeConfigurationService.replaceForSubject(user.id, req.params.id as string, req.body),
    );
  },

  async getTemplateForSemester(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const template = await gradeConfigurationService.getTemplateForSemester(
      user.id,
      req.params.id as string,
    );

    ok(res, template);
  },

  async replaceTemplateForSemester(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(
      res,
      await gradeConfigurationService.replaceTemplateForSemester(
        user.id,
        req.params.id as string,
        req.body,
      ),
    );
  },

  async getUserDefault(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await gradeConfigurationService.getUserDefault(user.id));
  },

  async replaceUserDefault(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await gradeConfigurationService.replaceUserDefault(user.id, req.body));
  },
};
