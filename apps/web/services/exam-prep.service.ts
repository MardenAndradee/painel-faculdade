import type {
  AddExamPrepMaterialInput,
  BulkCreateExamPrepItemsInput,
  CreateExamPrepInput,
  CreateExamPrepItemInput,
  ExamPrepDeletionPreview,
  ExamPrepDetail,
  UpdateExamPrepItemInput,
  UpdateExamPrepNotesInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const examPrepService = {
  create(examId: string): Promise<ExamPrepDetail> {
    return httpClient.post<ExamPrepDetail>('/exam-preps', {
      examId,
    } satisfies CreateExamPrepInput);
  },

  getById(id: string): Promise<ExamPrepDetail> {
    return httpClient.get<ExamPrepDetail>(`/exam-preps/${id}`);
  },

  createItem(examPrepId: string, data: CreateExamPrepItemInput): Promise<ExamPrepDetail> {
    return httpClient.post<ExamPrepDetail>(`/exam-preps/${examPrepId}/items`, data);
  },

  bulkCreateItems(examPrepId: string, data: BulkCreateExamPrepItemsInput): Promise<ExamPrepDetail> {
    return httpClient.post<ExamPrepDetail>(`/exam-preps/${examPrepId}/items/bulk`, data);
  },

  updateItem(itemId: string, data: UpdateExamPrepItemInput): Promise<void> {
    return httpClient.patch<void>(`/exam-prep-items/${itemId}`, data);
  },

  deleteItem(itemId: string): Promise<void> {
    return httpClient.delete<void>(`/exam-prep-items/${itemId}`);
  },

  updateNotes(examPrepId: string, data: UpdateExamPrepNotesInput): Promise<void> {
    return httpClient.patch<void>(`/exam-preps/${examPrepId}/notes`, data);
  },

  addMaterial(examPrepId: string, data: AddExamPrepMaterialInput): Promise<ExamPrepDetail> {
    return httpClient.post<ExamPrepDetail>(`/exam-preps/${examPrepId}/materials`, data);
  },

  removeMaterial(materialId: string): Promise<void> {
    return httpClient.delete<void>(`/exam-prep-materials/${materialId}`);
  },

  getDeletionPreview(examPrepId: string): Promise<ExamPrepDeletionPreview> {
    return httpClient.get<ExamPrepDeletionPreview>(`/exam-preps/${examPrepId}/deletion-preview`);
  },

  remove(examPrepId: string): Promise<void> {
    return httpClient.delete<void>(`/exam-preps/${examPrepId}`);
  },
};
