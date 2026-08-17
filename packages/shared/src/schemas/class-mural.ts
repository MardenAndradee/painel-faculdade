import { z } from 'zod';

/**
 * Contrato do Mural da turma (Etapa 22): avisos.
 *
 * Só o dono publica (ver tabela de papéis no README). Anotações fizeram
 * parte do desenho original (documento Tiptap, mesmo formato de `Note`),
 * mas não chegaram a ser usadas e foram removidas.
 */

const titleSchema = z
  .string({ error: 'Informe o título' })
  .trim()
  .min(2, 'O título precisa de ao menos 2 caracteres')
  .max(200, 'O título pode ter no máximo 200 caracteres');

const pinnedSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === 'true');

// --- Avisos ----------------------------------------------------------------------

const announcementContentSchema = z
  .string({ error: 'Informe o conteúdo' })
  .trim()
  .min(1, 'Informe o conteúdo')
  .max(4000, 'O conteúdo pode ter no máximo 4000 caracteres');

export const createClassAnnouncementSchema = z.object({
  title: titleSchema,
  content: announcementContentSchema,
  pinned: pinnedSchema,
});

export type CreateClassAnnouncementInput = z.output<typeof createClassAnnouncementSchema>;
export type ClassAnnouncementFormValues = z.input<typeof createClassAnnouncementSchema>;

export const updateClassAnnouncementSchema = z.object({
  title: titleSchema.optional(),
  content: announcementContentSchema.optional(),
  pinned: pinnedSchema,
});

export type UpdateClassAnnouncementInput = z.infer<typeof updateClassAnnouncementSchema>;

export interface ClassAnnouncementItem {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
