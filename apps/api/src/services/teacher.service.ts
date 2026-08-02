import type { CreateTeacherInput, TeacherListItem, UpdateTeacherInput } from '@painel/shared';
import { teacherRepository, type TeacherRow } from '../repositories/teacher.repository.js';
import { AppError } from '../utils/app-error.js';
import { emptyToNull } from '../utils/text.js';

/** Regra de negocio de professores. */

/** Campos de texto opcionais chegam como '' do formulario; o banco guarda null. */
function toListItem(row: TeacherRow): TeacherListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    subjectCount: row._count.subjects,
    createdAt: row.createdAt.toISOString(),
  };
}

export const teacherService = {
  async list(userId: string, search?: string): Promise<TeacherListItem[]> {
    const rows = await teacherRepository.findAll(userId, search);

    return rows.map(toListItem);
  },

  async getById(userId: string, id: string): Promise<TeacherListItem> {
    const row = await teacherRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Professor');

    return toListItem(row);
  },

  async create(userId: string, input: CreateTeacherInput): Promise<TeacherListItem> {
    const existing = await teacherRepository.findByName(userId, input.name);

    if (existing) {
      throw AppError.conflict('Já existe um professor com este nome');
    }

    const row = await teacherRepository.create(userId, {
      name: input.name,
      email: emptyToNull(input.email),
      phone: emptyToNull(input.phone),
      notes: emptyToNull(input.notes),
    });

    return toListItem(row);
  },

  /**
   * Reaproveita o professor de mesmo nome, se houver.
   *
   * Usado na criacao inline dentro do formulario de disciplina: digitar um
   * nome ja cadastrado deve vincular ao existente, e nao criar duplicata.
   */
  async findOrCreateByName(userId: string, name: string): Promise<TeacherListItem> {
    const existing = await teacherRepository.findByName(userId, name);

    if (existing) return toListItem(existing);

    const row = await teacherRepository.create(userId, { name });

    return toListItem(row);
  },

  async update(userId: string, id: string, input: UpdateTeacherInput): Promise<TeacherListItem> {
    if (input.name) {
      const duplicate = await teacherRepository.findByName(userId, input.name);

      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict('Já existe um professor com este nome');
      }
    }

    const row = await teacherRepository.update(userId, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: emptyToNull(input.email) } : {}),
      ...(input.phone !== undefined ? { phone: emptyToNull(input.phone) } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
    });

    if (!row) throw AppError.notFound('Professor');

    return toListItem(row);
  },

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await teacherRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Professor');
  },
};
