import type { ClassPostListItem, CreateClassPostInput, UpdateClassPostInput } from '@painel/shared';
import { httpClient } from './http-client';

export const classPostService = {
  list(classId: string): Promise<ClassPostListItem[]> {
    return httpClient.get<ClassPostListItem[]>(`/classes/${classId}/posts`);
  },

  upcoming(classId: string, days = 7): Promise<ClassPostListItem[]> {
    return httpClient.get<ClassPostListItem[]>(`/classes/${classId}/posts/upcoming`, {
      query: { days },
    });
  },

  publish(classId: string, data: CreateClassPostInput): Promise<ClassPostListItem> {
    return httpClient.post<ClassPostListItem>(`/classes/${classId}/posts`, data);
  },

  update(classId: string, postId: string, data: UpdateClassPostInput): Promise<ClassPostListItem> {
    return httpClient.patch<ClassPostListItem>(`/classes/${classId}/posts/${postId}`, data);
  },

  remove(classId: string, postId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${classId}/posts/${postId}`);
  },
};
