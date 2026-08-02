import type {
  CreateSubjectInput,
  CreateTeacherInput,
  PaginationMeta,
  SubjectDeletionImpact,
  SubjectDetail,
  SubjectListItem,
  TeacherListItem,
  UpdateSubjectInput,
} from '@painel/shared';
import { httpClient } from './http-client';

/** Filtros da listagem, no formato aceito pela query string da API. */
export interface SubjectListParams {
  search?: string;
  semesterId?: string;
  status?: string;
  includeArchived?: boolean;
  sortBy?: string;
  order?: string;
  page?: number;
  perPage?: number;
}

export const subjectService = {
  list(params: SubjectListParams): Promise<{ data: SubjectListItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<SubjectListItem>('/subjects', { query: { ...params } });
  },

  getById(id: string): Promise<SubjectDetail> {
    return httpClient.get<SubjectDetail>(`/subjects/${id}`);
  },

  create(data: CreateSubjectInput): Promise<SubjectDetail> {
    return httpClient.post<SubjectDetail>('/subjects', data);
  },

  update(id: string, data: UpdateSubjectInput): Promise<SubjectDetail> {
    return httpClient.patch<SubjectDetail>(`/subjects/${id}`, data);
  },

  /** Arquiva: reversivel, preserva provas e notas. */
  archive(id: string): Promise<SubjectDetail> {
    return httpClient.delete<SubjectDetail>(`/subjects/${id}`);
  },

  restore(id: string): Promise<SubjectDetail> {
    return httpClient.post<SubjectDetail>(`/subjects/${id}/restore`);
  },

  /** Exclusao definitiva: remove provas, notas e materiais em cascata. */
  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/subjects/${id}`, { query: { permanent: true } });
  },

  deletionImpact(id: string): Promise<SubjectDeletionImpact> {
    return httpClient.get<SubjectDeletionImpact>(`/subjects/${id}/deletion-impact`);
  },
};

export const teacherService = {
  list(search?: string): Promise<TeacherListItem[]> {
    return httpClient.get<TeacherListItem[]>('/teachers', { query: { search } });
  },

  create(data: CreateTeacherInput): Promise<TeacherListItem> {
    return httpClient.post<TeacherListItem>('/teachers', data);
  },
};
