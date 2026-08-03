import type {
  CreateNoteFolderInput,
  CreateNoteInput,
  NoteDetail,
  NoteFolderListItem,
  NoteListItem,
  UpdateNoteFolderInput,
  UpdateNoteInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const noteFolderService = {
  listBySubject(subjectId: string): Promise<NoteFolderListItem[]> {
    return httpClient.get<NoteFolderListItem[]>('/note-folders', { query: { subjectId } });
  },

  create(data: CreateNoteFolderInput): Promise<NoteFolderListItem> {
    return httpClient.post<NoteFolderListItem>('/note-folders', data);
  },

  update(id: string, data: UpdateNoteFolderInput): Promise<NoteFolderListItem> {
    return httpClient.patch<NoteFolderListItem>(`/note-folders/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/note-folders/${id}`);
  },
};

export const noteService = {
  listBySubject(subjectId: string): Promise<NoteListItem[]> {
    return httpClient.get<NoteListItem[]>('/notes', { query: { subjectId } });
  },

  getById(id: string): Promise<NoteDetail> {
    return httpClient.get<NoteDetail>(`/notes/${id}`);
  },

  create(data: CreateNoteInput): Promise<NoteDetail> {
    return httpClient.post<NoteDetail>('/notes', data);
  },

  update(id: string, data: UpdateNoteInput): Promise<NoteDetail> {
    return httpClient.patch<NoteDetail>(`/notes/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/notes/${id}`);
  },
};
