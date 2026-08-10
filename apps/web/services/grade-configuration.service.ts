import type { GradeConfigurationInput, GradeConfigurationItem } from '@painel/shared';
import { httpClient } from './http-client';

export const gradeConfigurationService = {
  getForSubject(subjectId: string): Promise<GradeConfigurationItem> {
    return httpClient.get<GradeConfigurationItem>(`/subjects/${subjectId}/grade-configuration`);
  },

  replaceForSubject(
    subjectId: string,
    data: GradeConfigurationInput,
  ): Promise<GradeConfigurationItem> {
    return httpClient.put<GradeConfigurationItem>(
      `/subjects/${subjectId}/grade-configuration`,
      data,
    );
  },

  getTemplateForSemester(semesterId: string): Promise<GradeConfigurationItem | null> {
    return httpClient.get<GradeConfigurationItem | null>(
      `/semesters/${semesterId}/grade-configuration-template`,
    );
  },

  replaceTemplateForSemester(
    semesterId: string,
    data: GradeConfigurationInput,
  ): Promise<GradeConfigurationItem> {
    return httpClient.put<GradeConfigurationItem>(
      `/semesters/${semesterId}/grade-configuration-template`,
      data,
    );
  },

  getUserDefault(): Promise<GradeConfigurationItem | null> {
    return httpClient.get<GradeConfigurationItem | null>('/auth/me/default-grade-configuration');
  },

  replaceUserDefault(data: GradeConfigurationInput): Promise<GradeConfigurationItem> {
    return httpClient.put<GradeConfigurationItem>('/auth/me/default-grade-configuration', data);
  },
};
