'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateClassNoteInput, UpdateClassNoteInput } from '@painel/shared';
import { classNoteService } from '@/services/class-note.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de anotações do Mural (Etapa 22). */

export const classNoteKeys = {
  list: (classId: string) => ['classNotes', classId, 'list'] as const,
  detail: (classId: string, noteId: string) => ['classNotes', classId, 'detail', noteId] as const,
};

export function useClassNotes(classId: string) {
  return useQuery({
    queryKey: classNoteKeys.list(classId),
    queryFn: () => classNoteService.list(classId),
    enabled: Boolean(classId),
  });
}

export function useClassNote(classId: string, noteId: string | null) {
  return useQuery({
    queryKey: classNoteKeys.detail(classId, noteId ?? ''),
    queryFn: () => classNoteService.getById(classId, noteId as string),
    enabled: Boolean(classId) && noteId !== null,
  });
}

function useInvalidateClassNotes(classId: string) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: ['classNotes', classId] });
}

export function useCreateClassNote(classId: string) {
  const invalidate = useInvalidateClassNotes(classId);

  return useMutation({
    mutationFn: (data: CreateClassNoteInput) => classNoteService.create(classId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Anotação criada');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar a anotação')),
  });
}

/** Sem toast de sucesso: chamado a cada autosave, como `useUpdateNote`. */
export function useUpdateClassNote(classId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateClassNotes(classId);

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: UpdateClassNoteInput }) =>
      classNoteService.update(classId, noteId, data),
    onSuccess: async (note) => {
      queryClient.setQueryData(classNoteKeys.detail(classId, note.id), note);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar a anotação')),
  });
}

export function useRemoveClassNote(classId: string) {
  const invalidate = useInvalidateClassNotes(classId);

  return useMutation({
    mutationFn: (noteId: string) => classNoteService.remove(classId, noteId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Anotação excluída');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir a anotação')),
  });
}
