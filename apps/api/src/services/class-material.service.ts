import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import type {
  AttachmentSource,
  ClassMaterialItem,
  ClassMaterialStorageSummary,
  CreateClassMaterialLinkInput,
  UploadClassMaterialInput,
} from '@painel/shared';
import {
  classMaterialRepository,
  type ClassMaterialListRow,
} from '../repositories/class-material.repository.js';
import { classService } from './class.service.js';
import { storage } from '../storage/index.js';
import { contentMatchesExtension } from '../storage/file-signature.js';
import {
  buildStorageKey,
  isPreviewable,
  MIME_BY_EXTENSION,
  sanitizeDisplayName,
  typeFromExtension,
} from '../utils/attachment-content.js';
import { AppError } from '../utils/app-error.js';

/**
 * Materiais da turma (Etapa 23): linha única, sem *fan-out*. Reaproveita o
 * `StorageProvider`, a validação por *magic bytes* e o `multer` já usados
 * pelos materiais pessoais - só o dono do dado muda (turma, não usuário).
 *
 * Qualquer membro publica; o dono exclui qualquer material, um membro comum
 * só exclui o que ele mesmo enviou (ver tabela de papéis no README).
 */

function toItem(row: ClassMaterialListRow): ClassMaterialItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    source: row.source,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isPreviewable: isPreviewable(row.mimeType),
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireMembership(userId: string, classId: string) {
  return classService.assertMembership(userId, classId);
}

export const classMaterialService = {
  async list(userId: string, classId: string): Promise<ClassMaterialItem[]> {
    await requireMembership(userId, classId);

    return (await classMaterialRepository.listByClass(classId)).map(toItem);
  },

  async summary(userId: string, classId: string): Promise<ClassMaterialStorageSummary> {
    await requireMembership(userId, classId);

    return classMaterialRepository.summarize(classId);
  },

  /**
   * Recebe um arquivo.
   *
   * Mesma ordem do material pessoal: valida o conteudo, grava no storage,
   * só então cria o registro - uma falha no meio nunca deixa uma linha
   * apontando para um arquivo inexistente nem um blob orfao no disco.
   */
  async upload(
    userId: string,
    classId: string,
    file: Express.Multer.File,
    input: UploadClassMaterialInput,
  ): Promise<ClassMaterialItem> {
    await requireMembership(userId, classId);
    await classService.assertNotArchived(classId);

    const extension = extname(file.originalname).toLowerCase();

    if (!contentMatchesExtension(file.buffer, extension)) {
      throw AppError.badRequest(
        `O conteúdo do arquivo não corresponde à extensão ${extension}. Envie o arquivo original.`,
      );
    }

    const id = randomUUID();
    const storageKey = buildStorageKey(`classes/${classId}`, extension);
    const displayName = sanitizeDisplayName(
      input.name?.trim() || file.originalname.replace(extension, ''),
    );

    await storage.save(storageKey, file.buffer);

    try {
      const row = await classMaterialRepository.create(classId, userId, {
        id,
        name: displayName,
        type: typeFromExtension(extension),
        source: 'UPLOAD' satisfies AttachmentSource,
        url: `/classes/${classId}/materials/${id}/download`,
        storageKey,
        mimeType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
        sizeBytes: file.size,
      });

      return toItem(row);
    } catch (error) {
      await storage.remove(storageKey);
      throw error;
    }
  },

  /** Cria um material do tipo link. Nao ocupa espaco em disco. */
  async createLink(
    userId: string,
    classId: string,
    input: CreateClassMaterialLinkInput,
  ): Promise<ClassMaterialItem> {
    await requireMembership(userId, classId);
    await classService.assertNotArchived(classId);

    const row = await classMaterialRepository.create(classId, userId, {
      name: sanitizeDisplayName(input.name),
      type: 'LINK',
      source: 'LINK' satisfies AttachmentSource,
      url: input.url,
      storageKey: null,
      mimeType: null,
      sizeBytes: null,
    });

    return toItem(row);
  },

  /**
   * Abre o arquivo para download.
   *
   * A checagem de acesso é só a associação com a turma (via `requireMembership`,
   * 404 para não-membro) - não importa quem enviou, todo membro pode baixar.
   */
  async openForDownload(
    userId: string,
    classId: string,
    id: string,
  ): Promise<{ stream: Readable; fileName: string; mimeType: string; sizeBytes: number | null }> {
    await requireMembership(userId, classId);

    const row = await classMaterialRepository.findForStorage(classId, id);

    if (!row) throw AppError.notFound('Material');

    if (!row.storageKey) {
      throw AppError.badRequest('Este material é um link externo e não tem arquivo para baixar');
    }

    return {
      stream: await storage.createReadStream(row.storageKey),
      fileName: row.name,
      mimeType: row.mimeType ?? 'application/octet-stream',
      sizeBytes: row.sizeBytes,
    };
  },

  /** Exclui o registro e, quando houver, o arquivo. Dono exclui qualquer um; membro só o próprio. */
  async remove(userId: string, classId: string, id: string): Promise<void> {
    const role = await requireMembership(userId, classId);

    const row = await classMaterialRepository.findForStorage(classId, id);

    if (!row) throw AppError.notFound('Material');

    if (role !== 'OWNER' && row.uploadedById !== userId) {
      throw AppError.forbidden('Você só pode excluir materiais que você mesmo enviou');
    }

    await classMaterialRepository.delete(classId, id);

    if (row.storageKey) await storage.remove(row.storageKey);
  },
};
