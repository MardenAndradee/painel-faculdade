import { Router } from 'express';
import { z } from 'zod';
import { createGradeSchema, updateGradeSchema } from '@painel/shared';
import { gradeController } from '../controllers/grade.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de notas. Todas exigem sessao ativa. */
export const gradeRoutes: Router = Router();

gradeRoutes.use(authenticate);

const listQuerySchema = z.object({ subjectId: z.string().min(1).optional() });

// Rotas fixas precedem `/grades/:id`, para nao serem lidas como identificador.
gradeRoutes.get('/grades/overview', gradeController.overview);

gradeRoutes.get(
  '/grades/subject/:id',
  validate({ params: idParamSchema }),
  gradeController.subjectSummary,
);

gradeRoutes.get('/grades', validate({ query: listQuerySchema }), gradeController.list);

gradeRoutes.post('/grades', validate({ body: createGradeSchema }), gradeController.create);

gradeRoutes.patch(
  '/grades/:id',
  validate({ params: idParamSchema, body: updateGradeSchema }),
  gradeController.update,
);

gradeRoutes.delete('/grades/:id', validate({ params: idParamSchema }), gradeController.remove);
