import type { CreateNoteInput, NoteDetail, NoteListItem, UpdateNoteInput } from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  noteRepository,
  type NoteDetailRow,
  type NoteListRow,
} from '../repositories/note.repository.js';
import { noteFolderRepository } from '../repositories/note-folder.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { AppError } from '../utils/app-error.js';

/** Regra de negocio de notas. */

const EMPTY_DOCUMENT: Prisma.InputJsonValue = { type: 'doc', content: [] };

function toListItem(row: NoteListRow): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subjectId,
    folderId: row.folderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: NoteDetailRow): NoteDetail {
  return {
    ...toListItem(row),
    content: row.content as Record<string, unknown>,
  };
}

async function assertFolderValid(
  userId: string,
  subjectId: string,
  folderId: string,
): Promise<void> {
  const folder = await noteFolderRepository.findById(userId, folderId);

  if (!folder || folder.subjectId !== subjectId) {
    throw AppError.badRequest('Pasta inválida');
  }
}

export const noteService = {
  async listBySubject(userId: string, subjectId: string): Promise<NoteListItem[]> {
    const rows = await noteRepository.findBySubject(userId, subjectId);

    return rows.map(toListItem);
  },

  async getById(userId: string, id: string): Promise<NoteDetail> {
    const row = await noteRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Nota');

    return toDetail(row);
  },

  async create(userId: string, input: CreateNoteInput): Promise<NoteDetail> {
    const subject = await subjectRepository.findById(userId, input.subjectId);

    if (!subject) throw AppError.badRequest('Disciplina inválida');

    if (input.folderId) {
      await assertFolderValid(userId, input.subjectId, input.folderId);
    }

    const row = await noteRepository.create(userId, {
      title: input.title,
      subjectId: input.subjectId,
      folderId: input.folderId ?? null,
      content: (input.content as Prisma.InputJsonValue | undefined) ?? EMPTY_DOCUMENT,
    });

    return toDetail(row);
  },

  async update(userId: string, id: string, input: UpdateNoteInput): Promise<NoteDetail> {
    const current = await noteRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Nota');

    if (input.folderId !== undefined && input.folderId !== null) {
      await assertFolderValid(userId, current.subjectId, input.folderId);
    }

    const row = await noteRepository.update(userId, id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
      ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
    });

    if (!row) throw AppError.notFound('Nota');

    return toDetail(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await noteRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Nota');
  },
};
