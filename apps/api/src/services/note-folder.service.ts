import type {
  CreateNoteFolderInput,
  NoteFolderListItem,
  UpdateNoteFolderInput,
} from '@painel/shared';
import {
  noteFolderRepository,
  type NoteFolderRow,
} from '../repositories/note-folder.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { AppError } from '../utils/app-error.js';

/** Regra de negocio de pastas de anotacoes. */

function toListItem(row: NoteFolderRow): NoteFolderListItem {
  return {
    id: row.id,
    name: row.name,
    subjectId: row.subjectId,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Confirma que a pasta-mae e valida: existe, pertence ao usuario, esta na
 * mesma disciplina e - ao mover uma pasta existente - nao fica dentro dela
 * mesma nem de uma de suas proprias descendentes.
 */
async function assertParentValid(
  userId: string,
  subjectId: string,
  parentId: string,
  excludeId?: string,
): Promise<void> {
  if (parentId === excludeId) {
    throw AppError.badRequest('Uma pasta não pode ser mãe de si mesma');
  }

  const parent = await noteFolderRepository.findById(userId, parentId);

  if (!parent || parent.subjectId !== subjectId) {
    throw AppError.badRequest('Pasta de destino inválida');
  }

  if (!excludeId) return;

  let current: string | null = parent.parentId;

  while (current) {
    if (current === excludeId) {
      throw AppError.badRequest('Não é possível mover uma pasta para dentro dela mesma');
    }

    const ancestor: NoteFolderRow | null = await noteFolderRepository.findById(userId, current);
    current = ancestor?.parentId ?? null;
  }
}

export const noteFolderService = {
  async listBySubject(userId: string, subjectId: string): Promise<NoteFolderListItem[]> {
    const rows = await noteFolderRepository.findBySubject(userId, subjectId);

    return rows.map(toListItem);
  },

  async create(userId: string, input: CreateNoteFolderInput): Promise<NoteFolderListItem> {
    const subject = await subjectRepository.findById(userId, input.subjectId);

    if (!subject) throw AppError.badRequest('Disciplina inválida');

    if (input.parentId) {
      await assertParentValid(userId, input.subjectId, input.parentId);
    }

    const row = await noteFolderRepository.create(userId, {
      name: input.name,
      subjectId: input.subjectId,
      parentId: input.parentId ?? null,
    });

    return toListItem(row);
  },

  async update(
    userId: string,
    id: string,
    input: UpdateNoteFolderInput,
  ): Promise<NoteFolderListItem> {
    const current = await noteFolderRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Pasta');

    if (input.parentId !== undefined && input.parentId !== null) {
      await assertParentValid(userId, current.subjectId, input.parentId, id);
    }

    const row = await noteFolderRepository.update(userId, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    });

    if (!row) throw AppError.notFound('Pasta');

    return toListItem(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await noteFolderRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Pasta');
  },
};
