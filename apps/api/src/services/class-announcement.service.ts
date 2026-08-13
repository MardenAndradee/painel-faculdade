import type {
  ClassAnnouncementItem,
  CreateClassAnnouncementInput,
  UpdateClassAnnouncementInput,
} from '@painel/shared';
import { classRepository } from '../repositories/class.repository.js';
import {
  classAnnouncementRepository,
  type ClassAnnouncementRow,
} from '../repositories/class-announcement.repository.js';
import { classService } from './class.service.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * Avisos do Mural da turma (Etapa 22): texto simples, fixável, só o dono
 * publica. Notifica todo membro ativo menos o autor - ver decisão no
 * README ("Aviso notifica todos menos o autor").
 */

function toItem(row: ClassAnnouncementRow): ClassAnnouncementItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireMembership(userId: string, classId: string) {
  return classService.assertMembership(userId, classId);
}

function requireOwner(role: Awaited<ReturnType<typeof requireMembership>>): void {
  if (role !== 'OWNER') throw AppError.forbidden('Apenas o dono da turma pode publicar avisos');
}

export const classAnnouncementService = {
  async list(userId: string, classId: string): Promise<ClassAnnouncementItem[]> {
    await requireMembership(userId, classId);

    return (await classAnnouncementRepository.listByClass(classId)).map(toItem);
  },

  async create(
    userId: string,
    classId: string,
    input: CreateClassAnnouncementInput,
  ): Promise<ClassAnnouncementItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);
    await classService.assertNotArchived(classId);

    const row = await classAnnouncementRepository.create(classId, userId, {
      title: input.title,
      content: input.content,
      pinned: input.pinned,
    });

    const [memberUserIds, className] = await Promise.all([
      classRepository.listActiveMemberUserIds(classId),
      classRepository.findClassName(classId),
    ]);

    await notificationService.notifyClassAnnouncement(
      userId,
      className ?? 'sua turma',
      classId,
      row.title,
      memberUserIds,
    );

    return toItem(row);
  },

  async update(
    userId: string,
    classId: string,
    announcementId: string,
    input: UpdateClassAnnouncementInput,
  ): Promise<ClassAnnouncementItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const row = await classAnnouncementRepository.update(classId, announcementId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    });

    if (!row) throw AppError.notFound('Aviso');

    return toItem(row);
  },

  async remove(userId: string, classId: string, announcementId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const removed = await classAnnouncementRepository.remove(classId, announcementId);

    if (!removed) throw AppError.notFound('Aviso');
  },
};
