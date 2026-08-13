import type {
  ClassMaterialItem,
  ClassMaterialStorageSummary,
  CreateClassMaterialLinkInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const classMaterialService = {
  list(classId: string): Promise<ClassMaterialItem[]> {
    return httpClient.get<ClassMaterialItem[]>(`/classes/${classId}/materials`);
  },

  summary(classId: string): Promise<ClassMaterialStorageSummary> {
    return httpClient.get<ClassMaterialStorageSummary>(`/classes/${classId}/materials/summary`);
  },

  /**
   * Envia um arquivo.
   *
   * O `Content-Type` fica por conta do navegador (boundary do multipart) - o
   * `http-client` já pula o cabeçalho quando o corpo é `FormData`.
   */
  upload(classId: string, file: File, name?: string): Promise<ClassMaterialItem> {
    const form = new FormData();

    form.append('file', file);
    if (name) form.append('name', name);

    return httpClient.post<ClassMaterialItem>(`/classes/${classId}/materials/upload`, form);
  },

  createLink(classId: string, data: CreateClassMaterialLinkInput): Promise<ClassMaterialItem> {
    return httpClient.post<ClassMaterialItem>(`/classes/${classId}/materials/link`, data);
  },

  remove(classId: string, materialId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${classId}/materials/${materialId}`);
  },

  /** Baixa os bytes. O endpoint exige `Authorization`, entao passa pelo cliente. */
  download(classId: string, materialId: string): Promise<Blob> {
    return httpClient.getBlob(`/classes/${classId}/materials/${materialId}/download`);
  },
};
