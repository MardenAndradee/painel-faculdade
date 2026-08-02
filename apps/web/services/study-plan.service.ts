import type {
  AvailabilityWindow,
  CompleteStudySessionInput,
  CreateStudySessionInput,
  GeneratePlanInput,
  GeneratePlanResult,
  SaveAvailabilityInput,
  StudyPlanSummary,
  StudySessionItem,
  UpdateStudySessionInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const studyPlanService = {
  availability(): Promise<AvailabilityWindow[]> {
    return httpClient.get<AvailabilityWindow[]>('/study-plan/availability');
  },

  saveAvailability(data: SaveAvailabilityInput): Promise<AvailabilityWindow[]> {
    return httpClient.put<AvailabilityWindow[]>('/study-plan/availability', data);
  },

  summary(): Promise<StudyPlanSummary> {
    return httpClient.get<StudyPlanSummary>('/study-plan/summary');
  },

  list(from: Date, to: Date): Promise<StudySessionItem[]> {
    return httpClient.get<StudySessionItem[]>('/study-sessions', {
      query: { from: from.toISOString(), to: to.toISOString() },
    });
  },

  create(data: CreateStudySessionInput): Promise<StudySessionItem> {
    return httpClient.post<StudySessionItem>('/study-sessions', data);
  },

  update(id: string, data: UpdateStudySessionInput): Promise<StudySessionItem> {
    return httpClient.patch<StudySessionItem>(`/study-sessions/${id}`, data);
  },

  complete(id: string, data: CompleteStudySessionInput): Promise<StudySessionItem> {
    return httpClient.post<StudySessionItem>(`/study-sessions/${id}/complete`, data);
  },

  skip(id: string): Promise<StudySessionItem> {
    return httpClient.post<StudySessionItem>(`/study-sessions/${id}/skip`);
  },

  reopen(id: string): Promise<StudySessionItem> {
    return httpClient.post<StudySessionItem>(`/study-sessions/${id}/reopen`);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/study-sessions/${id}`);
  },

  generate(data: GeneratePlanInput): Promise<GeneratePlanResult> {
    return httpClient.post<GeneratePlanResult>('/study-plan/generate', data);
  },
};
