import { Router } from 'express';
import {
  attachmentQuerySchema,
  createLinkAttachmentSchema,
  updateAttachmentSchema,
  uploadAttachmentSchema,
} from '@painel/shared';
import { attachmentController } from '../controllers/attachment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { uploadSingleFile } from '../middlewares/upload.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de materiais. Todas exigem sessao ativa. */
export const attachmentRoutes: Router = Router();

attachmentRoutes.use(authenticate);

attachmentRoutes.get(
  '/attachments',
  validate({ query: attachmentQuerySchema }),
  attachmentController.list,
);

// Precede `/attachments/:id` para que "summary" nao seja lido como um id.
attachmentRoutes.get('/attachments/summary', attachmentController.summary);

/**
 * O multer precisa rodar ANTES do validate: os campos de texto do multipart so
 * existem em `req.body` depois que o corpo foi parseado.
 */
attachmentRoutes.post(
  '/attachments/upload',
  uploadSingleFile,
  validate({ body: uploadAttachmentSchema }),
  attachmentController.upload,
);

attachmentRoutes.post(
  '/attachments/link',
  validate({ body: createLinkAttachmentSchema }),
  attachmentController.createLink,
);

attachmentRoutes.get(
  '/attachments/:id',
  validate({ params: idParamSchema }),
  attachmentController.getById,
);

attachmentRoutes.get(
  '/attachments/:id/download',
  validate({ params: idParamSchema }),
  attachmentController.download,
);

attachmentRoutes.patch(
  '/attachments/:id',
  validate({ params: idParamSchema, body: updateAttachmentSchema }),
  attachmentController.update,
);

attachmentRoutes.delete(
  '/attachments/:id',
  validate({ params: idParamSchema }),
  attachmentController.remove,
);
