import { z } from 'zod';
import { cuidSchema } from '../common.js';

/**
 * Contrato de anotacoes.
 *
 * Uma disciplina tem uma arvore de pastas (auto-referenciada por `parentId`)
 * e notas de texto rico soltas na raiz ou dentro de uma pasta. O `content`
 * trafega como o documento JSON do editor (Tiptap/ProseMirror) - o backend
 * nunca interpreta essa estrutura, so guarda e devolve.
 */

const nameSchema = z
  .string({ error: 'Informe o nome' })
  .trim()
  .min(1, 'Informe o nome')
  .max(120, 'O nome pode ter no máximo 120 caracteres');

/** Documento do editor: validado apenas como objeto, a forma interna e do Tiptap. */
const noteContentSchema = z.record(z.string(), z.unknown());

export const noteQuerySchema = z.object({
  subjectId: cuidSchema,
});

export type NoteQuery = z.infer<typeof noteQuerySchema>;

// --- Pastas ------------------------------------------------------------------

export const createNoteFolderSchema = z.object({
  name: nameSchema,
  subjectId: cuidSchema,
  parentId: z.string().min(1).nullable().optional(),
});

export type CreateNoteFolderInput = z.infer<typeof createNoteFolderSchema>;

export const updateNoteFolderSchema = z.object({
  name: nameSchema.optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export type UpdateNoteFolderInput = z.infer<typeof updateNoteFolderSchema>;

export interface NoteFolderListItem {
  id: string;
  name: string;
  subjectId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Notas ---------------------------------------------------------------------

export const createNoteSchema = z.object({
  title: nameSchema,
  subjectId: cuidSchema,
  folderId: z.string().min(1).nullable().optional(),
  content: noteContentSchema.optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  title: nameSchema.optional(),
  folderId: z.string().min(1).nullable().optional(),
  content: noteContentSchema.optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export interface NoteListItem {
  id: string;
  title: string;
  subjectId: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends NoteListItem {
  content: Record<string, unknown>;
}
