import { Router } from 'express';
import { z } from 'zod';
import { createExamSchema, examQuerySchema, updateExamSchema } from '@painel/shared';
import { examController } from '../controllers/exam.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de provas. Todas exigem sessao ativa. */
export const examRoutes: Router = Router();

examRoutes.use(authenticate);

const countsQuerySchema = z.object({ subjectId: z.string().min(1).optional() });

examRoutes.get('/exams', validate({ query: examQuerySchema }), examController.list);

// Precede `/exams/:id` para que "counts" nao seja lido como um id.
examRoutes.get('/exams/counts', validate({ query: countsQuerySchema }), examController.counts);

examRoutes.post('/exams', validate({ body: createExamSchema }), examController.create);

examRoutes.get('/exams/:id', validate({ params: idParamSchema }), examController.getById);

examRoutes.patch(
  '/exams/:id',
  validate({ params: idParamSchema, body: updateExamSchema }),
  examController.update,
);

examRoutes.delete('/exams/:id', validate({ params: idParamSchema }), examController.remove);
