import type {
  CreateExamInput,
  ExamCounts,
  ExamListItem,
  PaginationMeta,
  UpdateExamInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export interface ExamListParams {
  view?: string;
  search?: string;
  subjectId?: string;
  sortBy?: string;
  order?: string;
  page?: number;
  perPage?: number;
}

export const examService = {
  list(params: ExamListParams): Promise<{ data: ExamListItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<ExamListItem>('/exams', { query: { ...params } });
  },

  counts(subjectId?: string): Promise<ExamCounts> {
    return httpClient.get<ExamCounts>('/exams/counts', { query: { subjectId } });
  },

  create(data: CreateExamInput): Promise<ExamListItem> {
    return httpClient.post<ExamListItem>('/exams', data);
  },

  update(id: string, data: UpdateExamInput): Promise<ExamListItem> {
    return httpClient.patch<ExamListItem>(`/exams/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/exams/${id}`);
  },
};
