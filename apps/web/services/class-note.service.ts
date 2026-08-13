import type {
  ClassNoteDetail,
  ClassNoteListItem,
  CreateClassNoteInput,
  UpdateClassNoteInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const classNoteService = {
  list(classId: string): Promise<ClassNoteListItem[]> {
    return httpClient.get<ClassNoteListItem[]>(`/classes/${classId}/notes`);
  },

  getById(classId: string, noteId: string): Promise<ClassNoteDetail> {
    return httpClient.get<ClassNoteDetail>(`/classes/${classId}/notes/${noteId}`);
  },

  create(classId: string, data: CreateClassNoteInput): Promise<ClassNoteDetail> {
    return httpClient.post<ClassNoteDetail>(`/classes/${classId}/notes`, data);
  },

  update(classId: string, noteId: string, data: UpdateClassNoteInput): Promise<ClassNoteDetail> {
    return httpClient.patch<ClassNoteDetail>(`/classes/${classId}/notes/${noteId}`, data);
  },

  remove(classId: string, noteId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${classId}/notes/${noteId}`);
  },
};
