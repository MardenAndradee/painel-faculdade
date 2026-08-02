import type {
  CreateGradeInput,
  GradeListItem,
  GradesOverview,
  SubjectGradeSummary,
  UpdateGradeInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const gradeService = {
  overview(): Promise<GradesOverview> {
    return httpClient.get<GradesOverview>('/grades/overview');
  },

  subjectSummary(subjectId: string): Promise<SubjectGradeSummary> {
    return httpClient.get<SubjectGradeSummary>(`/grades/subject/${subjectId}`);
  },

  list(subjectId?: string): Promise<GradeListItem[]> {
    return httpClient.get<GradeListItem[]>('/grades', { query: { subjectId } });
  },

  create(data: CreateGradeInput): Promise<GradeListItem> {
    return httpClient.post<GradeListItem>('/grades', data);
  },

  update(id: string, data: UpdateGradeInput): Promise<GradeListItem> {
    return httpClient.patch<GradeListItem>(`/grades/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/grades/${id}`);
  },
};
