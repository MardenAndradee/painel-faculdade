import type {
  ClassAnnouncementItem,
  CreateClassAnnouncementInput,
  UpdateClassAnnouncementInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const classAnnouncementService = {
  list(classId: string): Promise<ClassAnnouncementItem[]> {
    return httpClient.get<ClassAnnouncementItem[]>(`/classes/${classId}/announcements`);
  },

  create(classId: string, data: CreateClassAnnouncementInput): Promise<ClassAnnouncementItem> {
    return httpClient.post<ClassAnnouncementItem>(`/classes/${classId}/announcements`, data);
  },

  update(
    classId: string,
    announcementId: string,
    data: UpdateClassAnnouncementInput,
  ): Promise<ClassAnnouncementItem> {
    return httpClient.patch<ClassAnnouncementItem>(
      `/classes/${classId}/announcements/${announcementId}`,
      data,
    );
  },

  remove(classId: string, announcementId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${classId}/announcements/${announcementId}`);
  },
};
