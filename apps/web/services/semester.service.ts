import type {
  AcademicHistory,
  CloseSemesterPreview,
  CreateSemesterInput,
  SemesterListItem,
  UpdateSemesterInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const semesterService = {
  history(): Promise<AcademicHistory> {
    return httpClient.get<AcademicHistory>('/history');
  },

  list(): Promise<SemesterListItem[]> {
    return httpClient.get<SemesterListItem[]>('/semesters');
  },

  create(data: CreateSemesterInput): Promise<SemesterListItem> {
    return httpClient.post<SemesterListItem>('/semesters', data);
  },

  update(id: string, data: UpdateSemesterInput): Promise<SemesterListItem> {
    return httpClient.patch<SemesterListItem>(`/semesters/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/semesters/${id}`);
  },

  /** Prévia do que o encerramento vai consolidar. */
  closePreview(id: string): Promise<CloseSemesterPreview> {
    return httpClient.get<CloseSemesterPreview>(`/semesters/${id}/close-preview`);
  },

  close(id: string): Promise<SemesterListItem> {
    return httpClient.post<SemesterListItem>(`/semesters/${id}/close`);
  },

  reopen(id: string): Promise<SemesterListItem> {
    return httpClient.post<SemesterListItem>(`/semesters/${id}/reopen`);
  },
};
