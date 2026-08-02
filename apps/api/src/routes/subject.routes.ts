import { Router } from 'express';
import { subjectController } from '../controllers/subject.controller.js';
import { teacherController } from '../controllers/teacher.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  createSubjectSchema,
  createTeacherSchema,
  deleteSubjectQuerySchema,
  idParamSchema,
  subjectQuerySchema,
  teacherQuerySchema,
  updateSubjectSchema,
  updateTeacherSchema,
} from '../validators/subject.validators.js';

/** Rotas de disciplinas e professores. Todas exigem sessao ativa. */
export const subjectRoutes: Router = Router();

subjectRoutes.use(authenticate);

// --- Disciplinas -------------------------------------------------------------

subjectRoutes.get('/subjects', validate({ query: subjectQuerySchema }), subjectController.list);

subjectRoutes.post('/subjects', validate({ body: createSubjectSchema }), subjectController.create);

subjectRoutes.get('/subjects/:id', validate({ params: idParamSchema }), subjectController.getById);

subjectRoutes.get(
  '/subjects/:id/deletion-impact',
  validate({ params: idParamSchema }),
  subjectController.deletionImpact,
);

subjectRoutes.patch(
  '/subjects/:id',
  validate({ params: idParamSchema, body: updateSubjectSchema }),
  subjectController.update,
);

// Sem `?permanent=true` esta rota arquiva em vez de excluir.
subjectRoutes.delete(
  '/subjects/:id',
  validate({ params: idParamSchema, query: deleteSubjectQuerySchema }),
  subjectController.remove,
);

subjectRoutes.post(
  '/subjects/:id/restore',
  validate({ params: idParamSchema }),
  subjectController.restore,
);

// --- Professores -------------------------------------------------------------

subjectRoutes.get('/teachers', validate({ query: teacherQuerySchema }), teacherController.list);

subjectRoutes.post('/teachers', validate({ body: createTeacherSchema }), teacherController.create);

subjectRoutes.get('/teachers/:id', validate({ params: idParamSchema }), teacherController.getById);

subjectRoutes.patch(
  '/teachers/:id',
  validate({ params: idParamSchema, body: updateTeacherSchema }),
  teacherController.update,
);

subjectRoutes.delete(
  '/teachers/:id',
  validate({ params: idParamSchema }),
  teacherController.remove,
);
