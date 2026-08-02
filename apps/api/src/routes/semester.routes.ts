import { Router } from 'express';
import { createSemesterSchema, updateSemesterSchema } from '@painel/shared';
import { semesterController } from '../controllers/semester.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de semestres e historico. Todas exigem sessao ativa. */
export const semesterRoutes: Router = Router();

semesterRoutes.use(authenticate);

// Historico academico agrupado.
semesterRoutes.get('/history', semesterController.history);

semesterRoutes.get('/semesters', semesterController.list);

semesterRoutes.post(
  '/semesters',
  validate({ body: createSemesterSchema }),
  semesterController.create,
);

semesterRoutes.get(
  '/semesters/:id',
  validate({ params: idParamSchema }),
  semesterController.getById,
);

semesterRoutes.get(
  '/semesters/:id/close-preview',
  validate({ params: idParamSchema }),
  semesterController.previewClose,
);

semesterRoutes.post(
  '/semesters/:id/close',
  validate({ params: idParamSchema }),
  semesterController.close,
);

semesterRoutes.post(
  '/semesters/:id/reopen',
  validate({ params: idParamSchema }),
  semesterController.reopen,
);

semesterRoutes.patch(
  '/semesters/:id',
  validate({ params: idParamSchema, body: updateSemesterSchema }),
  semesterController.update,
);

semesterRoutes.delete(
  '/semesters/:id',
  validate({ params: idParamSchema }),
  semesterController.remove,
);
