import { z } from 'zod';
import { paginationQuerySchema } from '../common.js';
import { ATTACHMENT_SOURCE, ATTACHMENT_TYPE } from '../enums.js';
import type { AttachmentSource, AttachmentType } from '../enums.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de materiais.
 *
 * Um material e um arquivo enviado pelo usuario OU um link externo. As duas
 * formas convivem na mesma entidade porque, do ponto de vista de quem estuda,
 * um PDF baixado e um video no YouTube cumprem o mesmo papel: sao apoio a uma
 * disciplina. O que muda e o `source`, nao o significado.
 */

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  PDF: 'PDF',
  IMAGE: 'Imagem',
  ZIP: 'Compactado',
  SLIDE: 'Apresentação',
  LINK: 'Link',
  DOCUMENT: 'Documento',
  OTHER: 'Outro',
};

export const ATTACHMENT_SOURCE_LABELS: Record<AttachmentSource, string> = {
  UPLOAD: 'Enviado',
  LINK: 'Link',
  GOOGLE_CLASSROOM: 'Classroom',
  GOOGLE_DRIVE: 'Drive',
};

export const ATTACHMENT_SORT_FIELDS = ['createdAt', 'name', 'sizeBytes'] as const;
export type AttachmentSortField = (typeof ATTACHMENT_SORT_FIELDS)[number];

export const ATTACHMENT_SORT_LABELS: Record<AttachmentSortField, string> = {
  createdAt: 'Mais recentes',
  name: 'Nome',
  sizeBytes: 'Tamanho',
};

/**
 * Extensoes aceitas no upload.
 *
 * Allowlist, nunca blocklist: uma blocklist sempre esquece um formato
 * executavel novo. Tudo que nao esta aqui e recusado.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.zip',
  '.ppt',
  '.pptx',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.odt',
  '.ods',
  '.odp',
  '.txt',
  '.md',
  '.csv',
  '.rtf',
] as const;

/** Mapeia a extensao para o tipo mostrado na interface. */
export const EXTENSION_TO_TYPE: Record<string, AttachmentType> = {
  '.pdf': 'PDF',
  '.png': 'IMAGE',
  '.jpg': 'IMAGE',
  '.jpeg': 'IMAGE',
  '.gif': 'IMAGE',
  '.webp': 'IMAGE',
  '.svg': 'IMAGE',
  '.zip': 'ZIP',
  '.ppt': 'SLIDE',
  '.pptx': 'SLIDE',
  '.odp': 'SLIDE',
  '.doc': 'DOCUMENT',
  '.docx': 'DOCUMENT',
  '.odt': 'DOCUMENT',
  '.xls': 'DOCUMENT',
  '.xlsx': 'DOCUMENT',
  '.ods': 'DOCUMENT',
  '.txt': 'DOCUMENT',
  '.md': 'DOCUMENT',
  '.csv': 'DOCUMENT',
  '.rtf': 'DOCUMENT',
};

/**
 * Vinculo do material.
 *
 * Todos opcionais: um material pode ficar solto ("resumo geral de calculo"),
 * preso a uma disciplina, ou preso a uma atividade/prova especifica. O service
 * garante que no maximo um alvo seja informado.
 */
const targetSchema = z.object({
  subjectId: z.string().min(1).optional().or(z.literal('')),
  assignmentId: z.string().min(1).optional().or(z.literal('')),
  examId: z.string().min(1).optional().or(z.literal('')),
});

const nameSchema = z
  .string({ error: 'Informe o nome' })
  .trim()
  .min(1, 'Informe o nome')
  .max(200, 'O nome pode ter no máximo 200 caracteres');

/**
 * Metadados que acompanham o upload.
 *
 * Chegam como campos de texto do multipart, entao tudo e string. O `name` e
 * opcional: quando ausente, o service usa o nome original do arquivo.
 */
export const uploadAttachmentSchema = targetSchema.extend({
  name: nameSchema.optional().or(z.literal('')),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

/** Criacao de material do tipo link. */
export const createLinkAttachmentSchema = targetSchema.extend({
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

export type CreateLinkAttachmentInput = z.output<typeof createLinkAttachmentSchema>;
export type LinkAttachmentFormValues = z.input<typeof createLinkAttachmentSchema>;

/** Edicao: so o rotulo e o vinculo mudam. Trocar o arquivo e um novo upload. */
export const updateAttachmentSchema = targetSchema.extend({ name: nameSchema }).partial();

export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;

/**
 * Formulario de edicao.
 *
 * Difere do `updateAttachmentSchema` de proposito: no PATCH os campos sao
 * opcionais (enviar so o nome e valido), mas no formulario o nome e obrigatorio
 * - salvar com o campo em branco apagaria o rotulo do material.
 */
export const editAttachmentFormSchema = targetSchema.extend({ name: nameSchema });

export type EditAttachmentFormValues = z.input<typeof editAttachmentFormSchema>;

export const attachmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  subjectId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  type: z.enum(ATTACHMENT_TYPE).optional(),
  source: z.enum(ATTACHMENT_SOURCE).optional(),
  sortBy: z.enum(ATTACHMENT_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AttachmentQuery = z.infer<typeof attachmentQuerySchema>;

/** Referencia enxuta para "a que isso esta preso". */
export interface AttachmentLinkRef {
  id: string;
  title: string;
}

export interface AttachmentListItem {
  id: string;
  name: string;
  type: AttachmentType;
  source: AttachmentSource;
  /**
   * Nos links, o endereco externo completo. Nos uploads, o caminho de download
   * RELATIVO a raiz da API (`/attachments/:id/download`) - guardar o prefixo
   * `/api/v1` no banco amarraria os registros a uma versao da API.
   */
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Verdadeiro quando o navegador consegue exibir sem baixar. */
  isPreviewable: boolean;
  subject: SubjectRef | null;
  assignment: AttachmentLinkRef | null;
  exam: AttachmentLinkRef | null;
  createdAt: string;
  updatedAt: string;
}

/** Resumo do acervo, usado nos cartoes do topo da tela. */
export interface AttachmentStorageSummary {
  totalFiles: number;
  totalLinks: number;
  /** Soma dos bytes dos arquivos enviados. Links nao ocupam espaco. */
  totalBytes: number;
  byType: { type: AttachmentType; count: number }[];
}
