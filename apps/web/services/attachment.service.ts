import type {
  AttachmentListItem,
  AttachmentQuery,
  AttachmentStorageSummary,
  CreateLinkAttachmentInput,
  PaginationMeta,
  UpdateAttachmentInput,
} from '@painel/shared';
import { httpClient } from './http-client';

/** Vinculo opcional enviado junto com o arquivo. */
export interface AttachmentTarget {
  subjectId?: string | undefined;
  assignmentId?: string | undefined;
  examId?: string | undefined;
}

export const attachmentService = {
  list(
    query: Partial<AttachmentQuery>,
  ): Promise<{ data: AttachmentListItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<AttachmentListItem>('/attachments', {
      query: {
        page: query.page,
        perPage: query.perPage,
        search: query.search,
        subjectId: query.subjectId,
        assignmentId: query.assignmentId,
        examId: query.examId,
        type: query.type,
        source: query.source,
        sortBy: query.sortBy,
        order: query.order,
      },
    });
  },

  summary(): Promise<AttachmentStorageSummary> {
    return httpClient.get<AttachmentStorageSummary>('/attachments/summary');
  },

  /**
   * Envia um arquivo.
   *
   * O `Content-Type` fica por conta do navegador: definir `multipart/form-data`
   * na mao omitiria o `boundary` e o servidor nao conseguiria separar as
   * partes. O `http-client` ja pula o cabecalho quando o corpo e FormData.
   */
  upload(file: File, target: AttachmentTarget & { name?: string }): Promise<AttachmentListItem> {
    const form = new FormData();

    form.append('file', file);

    if (target.name) form.append('name', target.name);
    if (target.subjectId) form.append('subjectId', target.subjectId);
    if (target.assignmentId) form.append('assignmentId', target.assignmentId);
    if (target.examId) form.append('examId', target.examId);

    return httpClient.post<AttachmentListItem>('/attachments/upload', form);
  },

  createLink(data: CreateLinkAttachmentInput): Promise<AttachmentListItem> {
    return httpClient.post<AttachmentListItem>('/attachments/link', data);
  },

  update(id: string, data: UpdateAttachmentInput): Promise<AttachmentListItem> {
    return httpClient.patch<AttachmentListItem>(`/attachments/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return httpClient.delete<void>(`/attachments/${id}`);
  },

  /** Baixa os bytes. O endpoint exige `Authorization`, entao passa pelo cliente. */
  download(id: string): Promise<Blob> {
    return httpClient.getBlob(`/attachments/${id}/download`);
  },
};
