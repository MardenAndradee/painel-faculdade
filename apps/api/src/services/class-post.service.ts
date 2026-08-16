import { randomUUID } from 'node:crypto';
import type { ClassPostListItem, CreateClassPostInput, UpdateClassPostInput } from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import { classRepository } from '../repositories/class.repository.js';
import { classPostRepository, type ClassPostRow } from '../repositories/class-post.repository.js';
import { classService } from './class.service.js';
import {
  ensureMemberSubjectLink,
  type ClassSubjectTemplate,
} from './class-subject-linking.service.js';
import { AppError } from '../utils/app-error.js';
import { emptyToNull } from '../utils/text.js';
import {
  toAssignmentFields,
  toEventFields,
  toExamFields,
  type ClassPostFields,
} from '../utils/class-post-fields.js';

/**
 * Publicação compartilhada (Etapa 21): o dono publica atividade, prova ou
 * evento; cada membro ativo ganha uma cópia pessoal (*fan-out*).
 *
 * A inserção das cópias é em lote (`createMany`, uma query por tabela) -
 * mesmo no teto de 100 membros da turma isso fica bem longe do limite de
 * duração de função da Vercel. Só a resolução de disciplina por membro
 * (`ensureMemberSubjectLink`) permanece sequencial, e só quando o membro
 * ainda não tem a disciplina vinculada - o caso raro depois da Etapa 20.
 */

interface MemberTarget {
  id: string;
  userId: string;
  semesterId: string;
}

function toListItem(row: ClassPostRow): ClassPostListItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    date: row.date?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    room: row.room,
    dueDate: row.dueDate?.toISOString() ?? null,
    priority: row.priority,
    maxPoints: row.maxPoints,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    allDay: row.allDay,
    classSubject: row.classSubject,
    createdBy: row.createdBy,
    copyCount: row._count.copies,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFields(row: ClassPostRow): ClassPostFields {
  return {
    title: row.title,
    description: row.description,
    date: row.date,
    durationMinutes: row.durationMinutes,
    room: row.room,
    dueDate: row.dueDate,
    priority: row.priority,
    maxPoints: row.maxPoints,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
  };
}

async function requireMembership(userId: string, classId: string) {
  return classService.assertMembership(userId, classId);
}

function requireOwner(role: Awaited<ReturnType<typeof requireMembership>>): void {
  if (role !== 'OWNER') throw AppError.forbidden('Apenas o dono da turma pode publicar');
}

/** Publicação: `classSubjectId` precisa pertencer à MESMA turma - nunca de outra. */
async function assertClassSubjectBelongs(
  classId: string,
  classSubjectId: string | null,
): Promise<void> {
  if (!classSubjectId) return;

  const classSubject = await classRepository.findSubject(classId, classSubjectId);

  if (!classSubject) throw AppError.badRequest('Disciplina inválida para esta turma');
}

export const classPostService = {
  /** Só o ciclo atual (Etapa 30.8) - publicações de semestres já finalizados vivem na aba Histórico da turma. */
  async list(userId: string, classId: string): Promise<ClassPostListItem[]> {
    await requireMembership(userId, classId);

    const cycle = await classRepository.findCycle(classId);

    if (!cycle) throw AppError.notFound('Turma');

    return (await classPostRepository.listByClass(classId, cycle.semesterId)).map(toListItem);
  },

  async getById(userId: string, classId: string, postId: string): Promise<ClassPostListItem> {
    await requireMembership(userId, classId);

    const row = await classPostRepository.findById(classId, postId);

    if (!row) throw AppError.notFound('Publicação');

    return toListItem(row);
  },

  /** Recorte usado pela Visão geral da turma - só o ciclo atual (Etapa 30.8). */
  async upcoming(userId: string, classId: string, days = 7): Promise<ClassPostListItem[]> {
    await requireMembership(userId, classId);

    const cycle = await classRepository.findCycle(classId);

    if (!cycle) throw AppError.notFound('Turma');

    const now = new Date();
    const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return (await classPostRepository.findUpcoming(classId, cycle.semesterId, now, to)).map(
      toListItem,
    );
  },

  async publish(
    userId: string,
    classId: string,
    input: CreateClassPostInput,
  ): Promise<ClassPostListItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);
    await classService.assertNotArchived(classId);

    const classSubjectId = input.classSubjectId ?? null;

    await assertClassSubjectBelongs(classId, classSubjectId);

    const cycle = await classRepository.findCycle(classId);

    if (!cycle) throw AppError.notFound('Turma');

    const row = await classPostRepository.create(classId, userId, {
      kind: input.kind,
      title: input.title,
      description: emptyToNull(input.description),
      classSubjectId,
      ...cycle,
      date: input.kind === 'EXAM' ? input.date : null,
      durationMinutes: input.kind === 'EXAM' ? (input.durationMinutes ?? null) : null,
      room: input.kind === 'EXAM' ? emptyToNull(input.room) : null,
      dueDate: input.kind === 'ASSIGNMENT' ? (input.dueDate ?? null) : null,
      priority: input.kind === 'ASSIGNMENT' ? input.priority : null,
      maxPoints: input.kind === 'ASSIGNMENT' ? (input.maxPoints ?? null) : null,
      startsAt: input.kind === 'EVENT' ? input.startsAt : null,
      endsAt: input.kind === 'EVENT' ? input.endsAt : null,
      allDay: input.kind === 'EVENT' ? input.allDay : null,
    });

    const members = await classRepository.listActiveMembersWithSemester(classId);

    await this.fanOutCreate(row, members);

    const published = await classPostRepository.findById(classId, row.id);

    return toListItem(published!);
  },

  /**
   * Edita o post e propaga só nas cópias não divergentes - um `updateMany`
   * por tabela, filtrado por `detachedAt: null`, nunca um loop por membro.
   */
  async update(
    userId: string,
    classId: string,
    postId: string,
    input: UpdateClassPostInput,
  ): Promise<ClassPostListItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const current = await classPostRepository.findById(classId, postId);

    if (!current) throw AppError.notFound('Publicação');

    if (input.kind !== current.kind) {
      throw AppError.badRequest('Não é possível mudar o tipo de uma publicação já feita');
    }

    if (input.classSubjectId !== undefined && input.classSubjectId !== current.classSubjectId) {
      throw AppError.badRequest(
        'Não é possível trocar a disciplina de uma publicação já feita — exclua e publique de novo',
      );
    }

    const data: Prisma.ClassPostUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
    };

    if (input.kind === 'EXAM') {
      if (input.date !== undefined) data.date = input.date;
      if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes ?? null;
      if (input.room !== undefined) data.room = emptyToNull(input.room);
    } else if (input.kind === 'ASSIGNMENT') {
      if (input.dueDate !== undefined) data.dueDate = input.dueDate;
      if (input.priority !== undefined) data.priority = input.priority;
      if (input.maxPoints !== undefined) data.maxPoints = input.maxPoints ?? null;
    } else {
      if (input.startsAt !== undefined) data.startsAt = input.startsAt;
      if (input.endsAt !== undefined) data.endsAt = input.endsAt;
      if (input.allDay !== undefined) data.allDay = input.allDay;
    }

    const updated = await classPostRepository.update(classId, postId, data);

    if (!updated) throw AppError.notFound('Publicação');

    const fields = toFields(updated);

    if (updated.kind === 'ASSIGNMENT') {
      await classPostRepository.updateAssignmentCopies(postId, toAssignmentFields(fields));
    } else if (updated.kind === 'EXAM') {
      await classPostRepository.updateExamCopies(postId, toExamFields(fields));
    } else {
      await classPostRepository.updateEventCopies(postId, toEventFields(fields));
    }

    return toListItem(updated);
  },

  async remove(userId: string, classId: string, postId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const kind = await classPostRepository.remove(classId, postId);

    if (!kind) throw AppError.notFound('Publicação');
  },

  /**
   * *Fan-out* retroativo (Etapa 21): chamado quando alguém entra na turma
   * depois - percorre as publicações já vigentes do CICLO ATUAL (Etapa 30.8)
   * e cria a cópia que faltava para esse único membro, reaproveitando
   * `fanOutCreate`. Publicações de ciclos já finalizados ficam só no
   * Histórico - quem entra agora não recebe cópia pessoal delas.
   */
  async fanOutToNewMember(
    classId: string,
    memberId: string,
    userId: string,
    semesterId: string,
  ): Promise<void> {
    const cycle = await classRepository.findCycle(classId);

    if (!cycle) return;

    const posts = await classPostRepository.listByClass(classId, cycle.semesterId);

    for (const post of posts) {
      await this.fanOutCreate(post, [{ id: memberId, userId, semesterId }]);
    }
  },

  /**
   * Núcleo do *fan-out*: resolve a disciplina de cada membro (sequencial,
   * leituras baratas) e então grava as N cópias em UMA inserção em lote.
   */
  async fanOutCreate(post: ClassPostRow, members: MemberTarget[]): Promise<void> {
    if (members.length === 0) return;

    let classSubject: ClassSubjectTemplate | null = null;

    if (post.classSubjectId) {
      classSubject = await classRepository.findSubjectFull(post.classId, post.classSubjectId);

      if (!classSubject) return; // molde removido entre a publicação e o fan-out - nada a fazer
    }

    if (post.kind === 'EXAM' && !classSubject) {
      throw AppError.internal('Prova de turma publicada sem disciplina vinculada');
    }

    const targets: Array<{ member: MemberTarget; subjectId: string | null }> = [];

    for (const member of members) {
      const alreadyHasCopy = await classPostRepository.findCopy(post.id, member.userId);

      if (alreadyHasCopy) continue;

      const subjectId = classSubject
        ? (await ensureMemberSubjectLink(member.userId, member.semesterId, member.id, classSubject))
            .subjectId
        : null;

      targets.push({ member, subjectId });
    }

    if (targets.length === 0) return;

    const fields = toFields(post);

    if (post.kind === 'ASSIGNMENT') {
      const entityFields = toAssignmentFields(fields);
      const entityIds = targets.map(() => randomUUID());

      await classPostRepository.createAssignmentCopies(
        targets.map(({ member, subjectId }, index) => ({
          id: entityIds[index]!,
          userId: member.userId,
          subjectId,
          classPostId: post.id,
          ...entityFields,
        })),
      );

      await classPostRepository.createCopyRecords(
        targets.map(({ member }, index) => ({
          id: randomUUID(),
          classPostId: post.id,
          userId: member.userId,
          assignmentId: entityIds[index]!,
        })),
      );
    } else if (post.kind === 'EXAM') {
      const entityFields = toExamFields(fields);
      const entityIds = targets.map(() => randomUUID());

      await classPostRepository.createExamCopies(
        targets.map(({ member, subjectId }, index) => ({
          id: entityIds[index]!,
          userId: member.userId,
          subjectId: subjectId!,
          classPostId: post.id,
          ...entityFields,
        })),
      );

      await classPostRepository.createCopyRecords(
        targets.map(({ member }, index) => ({
          id: randomUUID(),
          classPostId: post.id,
          userId: member.userId,
          examId: entityIds[index]!,
        })),
      );
    } else {
      const entityFields = toEventFields(fields);
      const entityIds = targets.map(() => randomUUID());

      await classPostRepository.createEventCopies(
        targets.map(({ member, subjectId }, index) => ({
          id: entityIds[index]!,
          userId: member.userId,
          subjectId,
          classPostId: post.id,
          ...entityFields,
        })),
      );

      await classPostRepository.createCopyRecords(
        targets.map(({ member }, index) => ({
          id: randomUUID(),
          classPostId: post.id,
          userId: member.userId,
          calendarEventId: entityIds[index]!,
        })),
      );
    }
  },
};
