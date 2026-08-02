import { Router } from 'express';
import {
  completeStudySessionSchema,
  createStudySessionSchema,
  generatePlanSchema,
  saveAvailabilitySchema,
  studyPlanRangeSchema,
  updateStudySessionSchema,
} from '@painel/shared';
import { studyPlanController } from '../controllers/study-plan.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas do cronograma de estudos. Todas exigem sessao ativa. */
export const studyPlanRoutes: Router = Router();

studyPlanRoutes.use(authenticate);

// --- Disponibilidade -----------------------------------------------------------
// Precede `/study-sessions/:id` para nao ser lida como um id.

studyPlanRoutes.get('/study-plan/availability', studyPlanController.getAvailability);

studyPlanRoutes.put(
  '/study-plan/availability',
  validate({ body: saveAvailabilitySchema }),
  studyPlanController.saveAvailability,
);

studyPlanRoutes.get('/study-plan/summary', studyPlanController.summary);

studyPlanRoutes.post(
  '/study-plan/generate',
  validate({ body: generatePlanSchema }),
  studyPlanController.generate,
);

// --- Blocos ----------------------------------------------------------------------

studyPlanRoutes.get(
  '/study-sessions',
  validate({ query: studyPlanRangeSchema }),
  studyPlanController.list,
);

studyPlanRoutes.post(
  '/study-sessions',
  validate({ body: createStudySessionSchema }),
  studyPlanController.create,
);

studyPlanRoutes.patch(
  '/study-sessions/:id',
  validate({ params: idParamSchema, body: updateStudySessionSchema }),
  studyPlanController.update,
);

studyPlanRoutes.post(
  '/study-sessions/:id/complete',
  validate({ params: idParamSchema, body: completeStudySessionSchema }),
  studyPlanController.complete,
);

studyPlanRoutes.post(
  '/study-sessions/:id/skip',
  validate({ params: idParamSchema }),
  studyPlanController.skip,
);

studyPlanRoutes.post(
  '/study-sessions/:id/reopen',
  validate({ params: idParamSchema }),
  studyPlanController.reopen,
);

studyPlanRoutes.delete(
  '/study-sessions/:id',
  validate({ params: idParamSchema }),
  studyPlanController.remove,
);
