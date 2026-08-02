import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import {
  buildPaginationMeta,
  EXTENSION_TO_TYPE,
  type AttachmentListItem,
  type AttachmentQuery,
  type AttachmentSource,
  type AttachmentStorageSummary,
  type AttachmentType,
  type CreateLinkAttachmentInput,
  type PaginatedResult,
  type UpdateAttachmentInput,
  type UploadAttachmentInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  attachmentRepository,
  type AttachmentListRow,
  type AttachmentOwnerScope,
} from '../repositories/attachment.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { assignmentRepository } from '../repositories/assignment.repository.js';
import { examRepository } from '../repositories/exam.repository.js';
import { storage } from '../storage/index.js';
import { contentMatchesExtension } from '../storage/file-signature.js';
import { AppError } from '../utils/app-error.js';

/** Regra de negocio de materiais. */

/**
 * Tipos que o navegador exibe com seguranca dentro da aplicacao.
 *
 * SVG fica de fora de proposito: e XML e pode carregar script, entao exibi-lo
 * inline no nosso dominio seria XSS armazenado. SVG continua aceito no upload,
 * mas sempre desce como download.
 */
const PREVIEWABLE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** MIME confiavel derivado da extensao, ja que o do cliente nao vale nada. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
};

/**
 * Limpa o nome exibido.
 *
 * Este valor NUNCA vira caminho em disco - a chave de storage e gerada por nos.
 * A sanitizacao aqui serve para o cabecalho `Content-Disposition` e para a
 * interface: barras e caracteres de controle quebrariam o header e poderiam
 * ser usados para forjar um segundo cabecalho.
 */
function sanitizeDisplayName(name: string): string {
  /* A regex fica numa constante para que o Prettier nao quebre a linha e
     desloque o eslint-disable-next-line para longe dela. */
  // eslint-disable-next-line no-control-regex -- barrar controle e o objetivo
  const forbidden = /[\u0000-\u001f\u007f"\\/]+/g;

  const cleaned = name.replace(forbidden, ' ').replace(/\s+/g, ' ').trim();

  return cleaned.slice(0, 200) || 'arquivo';
}

/** Chave no storage: prefixo por usuario, particao por mes, nome aleatorio. */
function buildStorageKey(userId: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return `${userId}/${year}/${month}/${randomUUID()}${extension}`;
}

function typeFromExtension(extension: string): AttachmentType {
  return EXTENSION_TO_TYPE[extension.toLowerCase()] ?? 'OTHER';
}

function isPreviewable(mimeType: string | null): boolean {
  return mimeType !== null && PREVIEWABLE_MIME_TYPES.has(mimeType);
}

function toListItem(row: AttachmentListRow): AttachmentListItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    source: row.source,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isPreviewable: isPreviewable(row.mimeType),
    subject: row.subject,
    assignment: row.assignment,
    exam: row.exam,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Campos de vinculo vindos do cliente, ainda como strings possivelmente vazias. */
interface RawTarget {
  subjectId?: string | undefined;
  assignmentId?: string | undefined;
  examId?: string | undefined;
}

interface ResolvedTarget {
  subjectId: string | null;
  assignmentId: string | null;
  examId: string | null;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

/**
 * Resolve e valida o vinculo do material.
 *
 * Regras: no maximo um alvo, e o alvo precisa pertencer ao usuario. Permitir
 * dois alvos ao mesmo tempo criaria ambiguidade na hora de listar "materiais
 * desta prova" e na limpeza em cascata.
 */
async function resolveTarget(userId: string, raw: RawTarget): Promise<ResolvedTarget> {
  const subjectId = emptyToUndefined(raw.subjectId);
  const assignmentId = emptyToUndefined(raw.assignmentId);
  const examId = emptyToUndefined(raw.examId);

  const informed = [subjectId, assignmentId, examId].filter(Boolean);

  if (informed.length > 1) {
    throw AppError.badRequest(
      'Vincule o material a apenas um item: disciplina, atividade ou prova',
    );
  }

  if (subjectId && !(await subjectRepository.findById(userId, subjectId))) {
    throw AppError.badRequest('Disciplina inválida');
  }

  if (assignmentId && !(await assignmentRepository.findById(userId, assignmentId))) {
    throw AppError.badRequest('Atividade inválida');
  }

  if (examId && !(await examRepository.findById(userId, examId))) {
    throw AppError.badRequest('Prova inválida');
  }

  return {
    subjectId: subjectId ?? null,
    assignmentId: assignmentId ?? null,
    examId: examId ?? null,
  };
}

function buildOrderBy(query: AttachmentQuery): Prisma.AttachmentOrderByWithRelationInput[] {
  const direction = query.order;

  switch (query.sortBy) {
    case 'name':
      return [{ name: direction }, { createdAt: 'desc' }];

    case 'sizeBytes':
      // Links tem `sizeBytes` nulo; mandamos para o fim em qualquer direcao
      // para que a lista nao comece com uma sequencia de traços.
      return [{ sizeBytes: { sort: direction, nulls: 'last' } }, { createdAt: 'desc' }];

    case 'createdAt':
    default:
      return [{ createdAt: direction }];
  }
}

export const attachmentService = {
  async list(userId: string, query: AttachmentQuery): Promise<PaginatedResult<AttachmentListItem>> {
    const skip = (query.page - 1) * query.perPage;

    const { rows, total } = await attachmentRepository.findPaginated(
      userId,
      {
        search: query.search,
        subjectId: query.subjectId,
        assignmentId: query.assignmentId,
        examId: query.examId,
        type: query.type,
        source: query.source,
      },
      buildOrderBy(query),
      skip,
      query.perPage,
    );

    return {
      data: rows.map(toListItem),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  async getById(userId: string, id: string): Promise<AttachmentListItem> {
    const row = await attachmentRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Material');

    return toListItem(row);
  },

  async summary(userId: string): Promise<AttachmentStorageSummary> {
    const result = await attachmentRepository.summarize(userId);

    return {
      totalFiles: result.totalFiles,
      totalLinks: result.totalLinks,
      totalBytes: result.totalBytes,
      byType: result.byType,
    };
  },

  /**
   * Recebe um arquivo.
   *
   * Ordem deliberada: valida o conteudo ANTES de gravar, e grava no storage
   * ANTES de criar o registro. Assim uma falha no disco nao deixa uma linha
   * apontando para um arquivo inexistente. O caso inverso - blob gravado e
   * registro que falha - e tratado apagando o blob no catch.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    input: UploadAttachmentInput,
  ): Promise<AttachmentListItem> {
    const extension = extname(file.originalname).toLowerCase();

    if (!contentMatchesExtension(file.buffer, extension)) {
      throw AppError.badRequest(
        `O conteúdo do arquivo não corresponde à extensão ${extension}. Envie o arquivo original.`,
      );
    }

    const target = await resolveTarget(userId, input);

    const id = randomUUID();
    const storageKey = buildStorageKey(userId, extension);
    const displayName = sanitizeDisplayName(
      emptyToUndefined(input.name) ?? file.originalname.replace(extension, ''),
    );

    await storage.save(storageKey, file.buffer);

    try {
      const row = await attachmentRepository.create(userId, {
        id,
        name: displayName,
        type: typeFromExtension(extension),
        source: 'UPLOAD' satisfies AttachmentSource,
        // Sem o prefixo `/api/v1`: a versao da API nao pertence ao dado.
        url: `/attachments/${id}/download`,
        storageKey,
        mimeType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
        sizeBytes: file.size,
        ...target,
      });

      return toListItem(row);
    } catch (error) {
      await storage.remove(storageKey);
      throw error;
    }
  },

  /** Cria um material do tipo link. Nao ocupa espaco em disco. */
  async createLink(userId: string, input: CreateLinkAttachmentInput): Promise<AttachmentListItem> {
    const target = await resolveTarget(userId, input);

    const row = await attachmentRepository.create(userId, {
      name: sanitizeDisplayName(input.name),
      type: 'LINK' satisfies AttachmentType,
      source: 'LINK' satisfies AttachmentSource,
      url: input.url,
      storageKey: null,
      ...target,
    });

    return toListItem(row);
  },

  /** Renomeia e/ou reposiciona o material. O arquivo em si nunca muda. */
  async update(
    userId: string,
    id: string,
    input: UpdateAttachmentInput,
  ): Promise<AttachmentListItem> {
    const existing = await attachmentRepository.findById(userId, id);

    if (!existing) throw AppError.notFound('Material');

    const data: Prisma.AttachmentUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = sanitizeDisplayName(input.name);

    // O vinculo so e recalculado quando algum dos campos vem no payload; assim
    // um PATCH que muda apenas o nome nao desvincula o material.
    const touchesTarget =
      input.subjectId !== undefined ||
      input.assignmentId !== undefined ||
      input.examId !== undefined;

    if (touchesTarget) {
      const target = await resolveTarget(userId, input);

      data.subjectId = target.subjectId;
      data.assignmentId = target.assignmentId;
      data.examId = target.examId;
    }

    const row = await attachmentRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Material');

    return toListItem(row);
  },

  /** Abre o arquivo para download, ja com os metadados do cabecalho. */
  async openForDownload(
    userId: string,
    id: string,
  ): Promise<{ stream: Readable; fileName: string; mimeType: string; sizeBytes: number | null }> {
    const row = await attachmentRepository.findForStorage(userId, id);

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

  /** Exclui o registro e, quando houver, o arquivo. */
  async remove(userId: string, id: string): Promise<void> {
    const row = await attachmentRepository.findForStorage(userId, id);

    if (!row) throw AppError.notFound('Material');

    await attachmentRepository.delete(userId, id);

    if (row.storageKey) await storage.remove(row.storageKey);
  },

  /**
   * Apaga os blobs presos a uma disciplina, atividade ou prova.
   *
   * Chamado pelos services desses donos ANTES de excluir o registro. O banco
   * apaga as linhas de Attachment por cascata, mas nao conhece o disco - sem
   * esta chamada cada disciplina excluida deixaria os arquivos para tras.
   */
  async purgeStorageForOwner(userId: string, scope: AttachmentOwnerScope): Promise<void> {
    const keys = await attachmentRepository.findStorageKeysByOwner(userId, scope);

    if (keys.length > 0) await storage.removeMany(keys);
  },
};
