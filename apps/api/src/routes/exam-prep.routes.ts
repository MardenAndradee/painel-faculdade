import { Router } from 'express';
import { z } from 'zod';
import {
  addExamPrepMaterialSchema,
  bulkCreateExamPrepItemsSchema,
  createExamPrepItemSchema,
  createExamPrepSchema,
  updateExamPrepItemSchema,
  updateExamPrepNotesSchema,
} from '@painel/shared';
import { examPrepController } from '../controllers/exam-prep.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas do Plano de Estudos (Etapa 27). Todas exigem sessao ativa. */
export const examPrepRoutes: Router = Router();

examPrepRoutes.use(authenticate);

const itemParamSchema = z.object({ itemId: z.string().min(1, 'Identificador obrigatório') });
const materialParamSchema = z.object({
  materialId: z.string().min(1, 'Identificador obrigatório'),
});

examPrepRoutes.post(
  '/exam-preps',
  validate({ body: createExamPrepSchema }),
  examPrepController.create,
);

examPrepRoutes.get(
  '/exam-preps/:id',
  validate({ params: idParamSchema }),
  examPrepController.getById,
);

examPrepRoutes.post(
  '/exam-preps/:id/items',
  validate({ params: idParamSchema, body: createExamPrepItemSchema }),
  examPrepController.createItem,
);

examPrepRoutes.post(
  '/exam-preps/:id/items/bulk',
  validate({ params: idParamSchema, body: bulkCreateExamPrepItemsSchema }),
  examPrepController.bulkCreateItems,
);

examPrepRoutes.patch(
  '/exam-prep-items/:itemId',
  validate({ params: itemParamSchema, body: updateExamPrepItemSchema }),
  examPrepController.updateItem,
);

examPrepRoutes.delete(
  '/exam-prep-items/:itemId',
  validate({ params: itemParamSchema }),
  examPrepController.deleteItem,
);

examPrepRoutes.patch(
  '/exam-preps/:id/notes',
  validate({ params: idParamSchema, body: updateExamPrepNotesSchema }),
  examPrepController.updateNotes,
);

examPrepRoutes.post(
  '/exam-preps/:id/materials',
  validate({ params: idParamSchema, body: addExamPrepMaterialSchema }),
  examPrepController.addMaterial,
);

examPrepRoutes.delete(
  '/exam-prep-materials/:materialId',
  validate({ params: materialParamSchema }),
  examPrepController.removeMaterial,
);

// Precede `DELETE /exam-preps/:id` na leitura deste arquivo por afinidade, mas
// GET nao colide com DELETE de qualquer forma - so agrupado por assunto.
examPrepRoutes.get(
  '/exam-preps/:id/deletion-preview',
  validate({ params: idParamSchema }),
  examPrepController.getDeletionPreview,
);

examPrepRoutes.delete(
  '/exam-preps/:id',
  validate({ params: idParamSchema }),
  examPrepController.remove,
);
