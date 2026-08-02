import type { Request, Response } from 'express';
import type { DeckQuery, FlashcardQuery, StudyQueueQuery } from '@painel/shared';
import { deckService } from '../services/deck.service.js';
import { flashcardService } from '../services/flashcard.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok, paginated } from '../utils/http-response.js';

/** Camada HTTP de baralhos e cartoes. */

export const deckController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await deckService.list(user.id, req.query as unknown as DeckQuery));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await deckService.getById(user.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await deckService.create(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await deckService.update(user.id, req.params.id as string, req.body));
  },

  async archive(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await deckService.setArchived(user.id, req.params.id as string, true));
  },

  async unarchive(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await deckService.setArchived(user.id, req.params.id as string, false));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await deckService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};

export const flashcardController = {
  async listByDeck(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    paginated(
      res,
      await flashcardService.list(
        user.id,
        req.params.id as string,
        req.query as unknown as FlashcardQuery,
      ),
    );
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await flashcardService.create(user.id, req.body));
  },

  async createMany(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await flashcardService.createMany(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await flashcardService.update(user.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await flashcardService.remove(user.id, req.params.id as string);
    noContent(res);
  },

  async studyQueue(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await flashcardService.studyQueue(user.id, req.query as unknown as StudyQueueQuery));
  },

  async review(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await flashcardService.review(user.id, req.params.id as string, req.body));
  },

  async stats(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await flashcardService.stats(user.id));
  },
};
