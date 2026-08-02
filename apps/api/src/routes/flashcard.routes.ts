import { Router } from 'express';
import {
  bulkCreateFlashcardsSchema,
  createDeckSchema,
  createFlashcardSchema,
  deckQuerySchema,
  flashcardQuerySchema,
  reviewFlashcardSchema,
  studyQueueQuerySchema,
  updateDeckSchema,
  updateFlashcardSchema,
} from '@painel/shared';
import { deckController, flashcardController } from '../controllers/flashcard.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de flashcards. Todas exigem sessao ativa. */
export const flashcardRoutes: Router = Router();

flashcardRoutes.use(authenticate);

// --- Estudo -------------------------------------------------------------------
// Precedem `/decks/:id` e `/flashcards/:id` para nao serem lidas como ids.

flashcardRoutes.get(
  '/flashcards/queue',
  validate({ query: studyQueueQuerySchema }),
  flashcardController.studyQueue,
);

flashcardRoutes.get('/flashcards/stats', flashcardController.stats);

// --- Baralhos ---------------------------------------------------------------------

flashcardRoutes.get('/decks', validate({ query: deckQuerySchema }), deckController.list);

flashcardRoutes.post('/decks', validate({ body: createDeckSchema }), deckController.create);

flashcardRoutes.get('/decks/:id', validate({ params: idParamSchema }), deckController.getById);

flashcardRoutes.patch(
  '/decks/:id',
  validate({ params: idParamSchema, body: updateDeckSchema }),
  deckController.update,
);

flashcardRoutes.post(
  '/decks/:id/archive',
  validate({ params: idParamSchema }),
  deckController.archive,
);

flashcardRoutes.post(
  '/decks/:id/unarchive',
  validate({ params: idParamSchema }),
  deckController.unarchive,
);

flashcardRoutes.delete('/decks/:id', validate({ params: idParamSchema }), deckController.remove);

/** Cartoes de um baralho: a lista sempre nasce de um baralho. */
flashcardRoutes.get(
  '/decks/:id/cards',
  validate({ params: idParamSchema, query: flashcardQuerySchema }),
  flashcardController.listByDeck,
);

// --- Cartoes ------------------------------------------------------------------------

flashcardRoutes.post(
  '/flashcards',
  validate({ body: createFlashcardSchema }),
  flashcardController.create,
);

flashcardRoutes.post(
  '/flashcards/bulk',
  validate({ body: bulkCreateFlashcardsSchema }),
  flashcardController.createMany,
);

flashcardRoutes.patch(
  '/flashcards/:id',
  validate({ params: idParamSchema, body: updateFlashcardSchema }),
  flashcardController.update,
);

flashcardRoutes.post(
  '/flashcards/:id/review',
  validate({ params: idParamSchema, body: reviewFlashcardSchema }),
  flashcardController.review,
);

flashcardRoutes.delete(
  '/flashcards/:id',
  validate({ params: idParamSchema }),
  flashcardController.remove,
);
