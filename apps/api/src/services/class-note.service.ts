import type {
  ClassNoteDetail,
  ClassNoteListItem,
  CreateClassNoteInput,
  UpdateClassNoteInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  classNoteRepository,
  type ClassNoteDetailRow,
  type ClassNoteListRow,
} from '../repositories/class-note.repository.js';
import { classService } from './class.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * Anotações do Mural da turma (Etapa 22): mesmo formato de `Note` (documento
 * Tiptap), um autor só - o dono. Nada colaborativo, então nenhuma trava de
 * edição concorrente é necessária.
 */

const EMPTY_DOCUMENT: Prisma.InputJsonValue = { type: 'doc', content: [] };

function toListItem(row: ClassNoteListRow): ClassNoteListItem {
  return {
    id: row.id,
    title: row.title,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: ClassNoteDetailRow): ClassNoteDetail {
  return {
    ...toListItem(row),
    content: row.content as Record<string, unknown>,
  };
}

async function requireMembership(userId: string, classId: string) {
  return classService.assertMembership(userId, classId);
}

function requireOwner(role: Awaited<ReturnType<typeof requireMembership>>): void {
  if (role !== 'OWNER') throw AppError.forbidden('Apenas o dono da turma pode publicar anotações');
}

export const classNoteService = {
  async list(userId: string, classId: string): Promise<ClassNoteListItem[]> {
    await requireMembership(userId, classId);

    return (await classNoteRepository.listByClass(classId)).map(toListItem);
  },

  async getById(userId: string, classId: string, noteId: string): Promise<ClassNoteDetail> {
    await requireMembership(userId, classId);

    const row = await classNoteRepository.findById(classId, noteId);

    if (!row) throw AppError.notFound('Anotação');

    return toDetail(row);
  },

  async create(
    userId: string,
    classId: string,
    input: CreateClassNoteInput,
  ): Promise<ClassNoteDetail> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);
    await classService.assertNotArchived(classId);

    const row = await classNoteRepository.create(classId, userId, {
      title: input.title,
      content: (input.content as Prisma.InputJsonValue | undefined) ?? EMPTY_DOCUMENT,
    });

    return toDetail(row);
  },

  async update(
    userId: string,
    classId: string,
    noteId: string,
    input: UpdateClassNoteInput,
  ): Promise<ClassNoteDetail> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const row = await classNoteRepository.update(classId, noteId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
    });

    if (!row) throw AppError.notFound('Anotação');

    return toDetail(row);
  },

  async remove(userId: string, classId: string, noteId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const removed = await classNoteRepository.remove(classId, noteId);

    if (!removed) throw AppError.notFound('Anotação');
  },
};
