'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateNoteFolderInput,
  CreateNoteInput,
  UpdateNoteFolderInput,
  UpdateNoteInput,
} from '@painel/shared';
import { noteFolderService, noteService } from '@/services/note.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de anotacoes: pastas e notas de uma disciplina. */

export const noteKeys = {
  all: ['notes'] as const,
  folders: (subjectId: string) => ['notes', 'folders', subjectId] as const,
  list: (subjectId: string) => ['notes', 'list', subjectId] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
};

export function useNoteFolders(subjectId: string) {
  return useQuery({
    queryKey: noteKeys.folders(subjectId),
    queryFn: () => noteFolderService.listBySubject(subjectId),
    enabled: Boolean(subjectId),
  });
}

export function useNotes(subjectId: string) {
  return useQuery({
    queryKey: noteKeys.list(subjectId),
    queryFn: () => noteService.listBySubject(subjectId),
    enabled: Boolean(subjectId),
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    queryFn: () => noteService.getById(id as string),
    enabled: id !== null,
  });
}

function useInvalidateNotes(subjectId: string) {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: noteKeys.folders(subjectId) });
    await queryClient.invalidateQueries({ queryKey: noteKeys.list(subjectId) });
  };
}

export function useCreateNoteFolder(subjectId: string) {
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: (data: CreateNoteFolderInput) => noteFolderService.create(data),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar a pasta')),
  });
}

export function useUpdateNoteFolder(subjectId: string) {
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteFolderInput }) =>
      noteFolderService.update(id, data),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar a pasta')),
  });
}

export function useDeleteNoteFolder(subjectId: string) {
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: (id: string) => noteFolderService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Pasta excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir a pasta')),
  });
}

export function useCreateNote(subjectId: string) {
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: (data: CreateNoteInput) => noteService.create(data),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar a nota')),
  });
}

/**
 * Atualiza uma nota (titulo, pasta ou conteudo).
 *
 * Sem toast de sucesso: e chamado a cada autosave, e um toast a cada pausa de
 * digitação seria ruído. O indicador de "salvo" fica por conta de quem chama.
 */
export function useUpdateNote(subjectId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteInput }) =>
      noteService.update(id, data),
    onSuccess: async (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar a nota')),
  });
}

export function useDeleteNote(subjectId: string) {
  const invalidate = useInvalidateNotes(subjectId);

  return useMutation({
    mutationFn: (id: string) => noteService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Nota excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir a nota')),
  });
}
