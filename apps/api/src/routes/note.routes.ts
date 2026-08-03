import { Router } from 'express';
import {
  createNoteFolderSchema,
  createNoteSchema,
  noteQuerySchema,
  updateNoteFolderSchema,
  updateNoteSchema,
} from '@painel/shared';
import { noteController } from '../controllers/note.controller.js';
import { noteFolderController } from '../controllers/note-folder.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de anotacoes: pastas e notas de uma disciplina. Todas exigem sessao ativa. */
export const noteRoutes: Router = Router();

noteRoutes.use(authenticate);

noteRoutes.get('/note-folders', validate({ query: noteQuerySchema }), noteFolderController.list);

noteRoutes.post(
  '/note-folders',
  validate({ body: createNoteFolderSchema }),
  noteFolderController.create,
);

noteRoutes.patch(
  '/note-folders/:id',
  validate({ params: idParamSchema, body: updateNoteFolderSchema }),
  noteFolderController.update,
);

noteRoutes.delete(
  '/note-folders/:id',
  validate({ params: idParamSchema }),
  noteFolderController.remove,
);

noteRoutes.get('/notes', validate({ query: noteQuerySchema }), noteController.list);

noteRoutes.get('/notes/:id', validate({ params: idParamSchema }), noteController.getById);

noteRoutes.post('/notes', validate({ body: createNoteSchema }), noteController.create);

noteRoutes.patch(
  '/notes/:id',
  validate({ params: idParamSchema, body: updateNoteSchema }),
  noteController.update,
);

noteRoutes.delete('/notes/:id', validate({ params: idParamSchema }), noteController.remove);
