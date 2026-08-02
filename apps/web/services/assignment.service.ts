import type {
  AssignmentCounts,
  AssignmentListItem,
  CreateAssignmentInput,
  PaginationMeta,
  UpdateAssignmentInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export interface AssignmentListParams {
  view?: string;
  search?: string;
  subjectId?: string;
  priority?: string;
  status?: string;
  includeUndated?: boolean;
  sortBy?: string;
  order?: string;
  page?: number;
  perPage?: number;
}

export const assignmentService = {
  list(
    params: AssignmentListParams,
  ): Promise<{ data: AssignmentListItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<AssignmentListItem>('/assignments', { query: { ...params } });
  },

  counts(subjectId?: string): Promise<AssignmentCounts> {
    return httpClient.get<AssignmentCounts>('/assignments/counts', { query: { subjectId } });
  },

  create(data: CreateAssignmentInput): Promise<AssignmentListItem> {
    return httpClient.post<AssignmentListItem>('/assignments', data);
  },

  update(id: string, data: UpdateAssignmentInput): Promise<AssignmentListItem> {
    return httpClient.patch<AssignmentListItem>(`/assignments/${id}`, data);
  },

  toggleComplete(id: string): Promise<AssignmentListItem> {
    return httpClient.patch<AssignmentListItem>(`/assignments/${id}/toggle-complete`);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/assignments/${id}`);
  },
};
