import { Router } from 'express';
import { z } from 'zod';
import {
  assignmentQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from '@painel/shared';
import { assignmentController } from '../controllers/assignment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de atividades. Todas exigem sessao ativa. */
export const assignmentRoutes: Router = Router();

assignmentRoutes.use(authenticate);

const countsQuerySchema = z.object({ subjectId: z.string().min(1).optional() });

assignmentRoutes.get(
  '/assignments',
  validate({ query: assignmentQuerySchema }),
  assignmentController.list,
);

// Precede `/assignments/:id` para que "counts" nao seja lido como um id.
assignmentRoutes.get(
  '/assignments/counts',
  validate({ query: countsQuerySchema }),
  assignmentController.counts,
);

assignmentRoutes.post(
  '/assignments',
  validate({ body: createAssignmentSchema }),
  assignmentController.create,
);

assignmentRoutes.get(
  '/assignments/:id',
  validate({ params: idParamSchema }),
  assignmentController.getById,
);

assignmentRoutes.patch(
  '/assignments/:id',
  validate({ params: idParamSchema, body: updateAssignmentSchema }),
  assignmentController.update,
);

assignmentRoutes.patch(
  '/assignments/:id/toggle-complete',
  validate({ params: idParamSchema }),
  assignmentController.toggleComplete,
);

assignmentRoutes.delete(
  '/assignments/:id',
  validate({ params: idParamSchema }),
  assignmentController.remove,
);
