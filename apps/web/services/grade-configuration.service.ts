import type {
  GradeConfigurationInput,
  GradeConfigurationItem,
  GradeTemplatePropagationPreview,
  GradeTemplatePropagationResult,
} from '@painel/shared';
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

  /** Previa da propagacao do modelo para as disciplinas ja criadas (Etapa 18). */
  previewPropagation(semesterId: string): Promise<GradeTemplatePropagationPreview> {
    return httpClient.get<GradeTemplatePropagationPreview>(
      `/semesters/${semesterId}/grade-configuration-template/propagation-preview`,
    );
  },

  propagateTemplate(
    semesterId: string,
    subjectIds: string[],
  ): Promise<GradeTemplatePropagationResult> {
    return httpClient.post<GradeTemplatePropagationResult>(
      `/semesters/${semesterId}/grade-configuration-template/propagate`,
      { subjectIds },
    );
  },

  getUserDefault(): Promise<GradeConfigurationItem | null> {
    return httpClient.get<GradeConfigurationItem | null>('/auth/me/default-grade-configuration');
  },

  replaceUserDefault(data: GradeConfigurationInput): Promise<GradeConfigurationItem> {
    return httpClient.put<GradeConfigurationItem>('/auth/me/default-grade-configuration', data);
  },
};
