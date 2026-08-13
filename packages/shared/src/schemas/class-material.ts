import { z } from 'zod';
import type { AttachmentSource, AttachmentType } from '../enums.js';

/**
 * Contrato de materiais da turma (Etapa 23).
 *
 * Linha unica, sem *fan-out* - duplicar um PDF de 8 MB por membro seria
 * desperdicio direto de armazenamento. Reaproveita o mesmo par
 * arquivo-ou-link de `Attachment`, mas mora em tabela propria: o acervo e
 * contado por TURMA, nao por quem enviou.
 */

const nameSchema = z
  .string({ error: 'Informe o nome' })
  .trim()
  .min(1, 'Informe o nome')
  .max(200, 'O nome pode ter no máximo 200 caracteres');

/** Metadados que acompanham o upload - campos de texto do multipart, por isso tudo string. */
export const uploadClassMaterialSchema = z.object({
  name: nameSchema.optional().or(z.literal('')),
});

export type UploadClassMaterialInput = z.infer<typeof uploadClassMaterialSchema>;

export const createClassMaterialLinkSchema = z.object({
  name: nameSchema,
  url: z
    .string({ error: 'Informe o endereço' })
    .trim()
    .min(1, 'Informe o endereço')
    .max(2000, 'Endereço muito longo')
    .refine(
      (value) => /^https?:\/\//i.test(value),
      'O endereço precisa começar com http:// ou https://',
    ),
});

export type CreateClassMaterialLinkInput = z.output<typeof createClassMaterialLinkSchema>;
export type ClassMaterialLinkFormValues = z.input<typeof createClassMaterialLinkSchema>;

export interface ClassMaterialItem {
  id: string;
  name: string;
  type: AttachmentType;
  source: AttachmentSource;
  /** Nos links, o endereco externo. Nos uploads, o caminho de download relativo a raiz da API. */
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  isPreviewable: boolean;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

/** Resumo do acervo DA TURMA - nunca do membro que enviou cada arquivo. */
export interface ClassMaterialStorageSummary {
  totalFiles: number;
  totalLinks: number;
  totalBytes: number;
}
