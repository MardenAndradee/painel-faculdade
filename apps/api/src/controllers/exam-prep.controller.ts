import type { Request, Response } from 'express';
import type {
  AddExamPrepMaterialInput,
  BulkCreateExamPrepItemsInput,
  CreateExamPrepInput,
  CreateExamPrepItemInput,
  UpdateExamPrepItemInput,
  UpdateExamPrepNotesInput,
} from '@painel/shared';
import { examPrepService } from '../services/exam-prep.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP do Plano de Estudos (Etapa 27). */
export const examPrepController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { examId } = req.body as CreateExamPrepInput;

    created(res, await examPrepService.create(user.id, examId));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await examPrepService.getById(user.id, req.params.id as string));
  },

  async createItem(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const examPrepId = req.params.id as string;

    created(
      res,
      await examPrepService.createItem(user.id, examPrepId, req.body as CreateExamPrepItemInput),
    );
  },

  async bulkCreateItems(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const examPrepId = req.params.id as string;

    created(
      res,
      await examPrepService.bulkCreateItems(
        user.id,
        examPrepId,
        req.body as BulkCreateExamPrepItemsInput,
      ),
    );
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examPrepService.updateItem(
      user.id,
      req.params.itemId as string,
      req.body as UpdateExamPrepItemInput,
    );
    noContent(res);
  },

  async deleteItem(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examPrepService.deleteItem(user.id, req.params.itemId as string);
    noContent(res);
  },

  async updateNotes(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examPrepService.updateNotes(
      user.id,
      req.params.id as string,
      req.body as UpdateExamPrepNotesInput,
    );
    noContent(res);
  },

  async addMaterial(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const examPrepId = req.params.id as string;

    created(
      res,
      await examPrepService.addMaterial(user.id, examPrepId, req.body as AddExamPrepMaterialInput),
    );
  },

  async removeMaterial(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examPrepService.removeMaterial(user.id, req.params.materialId as string);
    noContent(res);
  },

  async getDeletionPreview(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await examPrepService.getDeletionPreview(user.id, req.params.id as string));
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await examPrepService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
