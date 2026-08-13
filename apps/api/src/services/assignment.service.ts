import {
  buildPaginationMeta,
  type AssignmentCounts,
  type AssignmentListItem,
  type AssignmentQuery,
  type CreateAssignmentInput,
  type PaginatedResult,
  type UpdateAssignmentInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  assignmentRepository,
  buildTimeBoundaries,
  type AssignmentListRow,
} from '../repositories/assignment.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { classPostRepository } from '../repositories/class-post.repository.js';
import { AppError } from '../utils/app-error.js';
import { attachmentService } from './attachment.service.js';
import { emptyToNull } from '../utils/text.js';

/** Campos que pertencem à publicação de origem (Etapa 21) - editá-los desvincula a cópia. */
const CLASS_POST_MANAGED_FIELDS = [
  'title',
  'description',
  'dueDate',
  'priority',
  'maxPoints',
] as const;

/** Regra de negocio de atividades. */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Campos de texto opcionais chegam como '' do formulario; o banco guarda null. */
/**
 * Diferenca em dias de calendario, ignorando a hora.
 *
 * Uma entrega hoje as 23h59 e "hoje" (0), e nao "amanha" por arredondamento
 * das horas restantes.
 */
function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function toListItem(row: AssignmentListRow, now: Date): AssignmentListItem {
  const isOpen = row.status === 'PENDING' || row.status === 'IN_PROGRESS';

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    notes: row.notes,
    dueDate: row.dueDate?.toISOString() ?? null,
    priority: row.priority,
    status: row.status,
    source: row.source,
    completedAt: row.completedAt?.toISOString() ?? null,
    maxPoints: row.maxPoints,
    classroomLink: row.classroomLink,
    subject: row.subject,
    fromClass: row.classPostId
      ? { classId: row.classPost!.class.id, className: row.classPost!.class.name }
      : null,
    daysUntilDue: row.dueDate ? daysBetween(now, row.dueDate) : null,
    // Concluida com prazo vencido nao e atrasada: ja foi entregue.
    isOverdue: isOpen && row.dueDate !== null && row.dueDate < now,
    attachmentCount: row._count.attachments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Confirma que a disciplina pertence ao usuario antes de vincular. */
async function assertSubjectOwnership(userId: string, subjectId: string | null): Promise<void> {
  if (!subjectId) return;

  const subject = await subjectRepository.findById(userId, subjectId);

  if (!subject) throw AppError.badRequest('Disciplina inválida');
}

export const assignmentService = {
  async list(userId: string, query: AssignmentQuery): Promise<PaginatedResult<AssignmentListItem>> {
    const time = buildTimeBoundaries();

    const filters = {
      view: query.view,
      search: query.search,
      subjectId: query.subjectId,
      classId: query.classId,
      priority: query.priority,
      status: query.status,
      includeUndated: query.includeUndated,
    };

    /**
     * Ordenacao.
     *
     * - `priority`: o enum foi declarado LOW -> URGENT, e o Postgres ordena
     *   enums pela ordem de declaracao, entao `desc` traz urgentes primeiro.
     * - `dueDate`: `nulls: 'last'` mantem atividades sem prazo no fim.
     * - `subject`: ordena pelo nome da disciplina via relacao.
     */
    const orderBy: Prisma.AssignmentOrderByWithRelationInput[] =
      query.sortBy === 'priority'
        ? [{ priority: query.order }, { dueDate: { sort: 'asc', nulls: 'last' } }]
        : query.sortBy === 'subject'
          ? [{ subject: { name: query.order } }, { dueDate: { sort: 'asc', nulls: 'last' } }]
          : query.sortBy === 'createdAt'
            ? [{ createdAt: query.order }]
            : query.sortBy === 'title'
              ? [{ title: query.order }]
              : [{ dueDate: { sort: query.order, nulls: 'last' } }, { priority: 'desc' }];

    const { rows, total } = await assignmentRepository.findPaginated(
      userId,
      filters,
      orderBy,
      (query.page - 1) * query.perPage,
      query.perPage,
      time,
    );

    return {
      data: rows.map((row) => toListItem(row, time.now)),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  async counts(userId: string, subjectId?: string): Promise<AssignmentCounts> {
    return assignmentRepository.countByView(userId, buildTimeBoundaries(), { subjectId });
  },

  async getById(userId: string, id: string): Promise<AssignmentListItem> {
    const row = await assignmentRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Atividade');

    return toListItem(row, new Date());
  },

  async create(userId: string, input: CreateAssignmentInput): Promise<AssignmentListItem> {
    const subjectId = input.subjectId ?? null;

    await assertSubjectOwnership(userId, subjectId);

    const row = await assignmentRepository.create(userId, {
      title: input.title,
      description: emptyToNull(input.description),
      notes: emptyToNull(input.notes),
      subjectId,
      dueDate: input.dueDate,
      priority: input.priority,
      status: input.status,
      // Criar ja concluida (registro retroativo) precisa carimbar a data.
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
      maxPoints: input.maxPoints ?? null,
      source: 'MANUAL',
    });

    return toListItem(row, new Date());
  },

  async update(
    userId: string,
    id: string,
    input: UpdateAssignmentInput,
  ): Promise<AssignmentListItem> {
    const current = await assignmentRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Atividade');

    if (input.subjectId !== undefined) {
      await assertSubjectOwnership(userId, input.subjectId ?? null);
    }

    const data: Prisma.AssignmentUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.maxPoints !== undefined ? { maxPoints: input.maxPoints ?? null } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId ?? null } : {}),
    };

    // `completedAt` acompanha o status: sair de concluida limpa a data, entrar
    // carimba - desde que ja nao houvesse uma, para nao perder o registro real.
    if (input.status !== undefined) {
      data.status = input.status;

      if (input.status === 'COMPLETED') {
        data.completedAt = current.completedAt ?? new Date();
      } else {
        data.completedAt = null;
      }
    }

    const row = await assignmentRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Atividade');

    // Editar um campo que a publicação da turma controla desvincula a cópia
    // (Etapa 21): a propagação futura de uma edição do dono passa a pular
    // esta atividade, que agora é definitivamente do membro.
    if (
      current.classPostId &&
      CLASS_POST_MANAGED_FIELDS.some((field) => input[field] !== undefined)
    ) {
      await classPostRepository.markDetached(current.classPostId, userId);
    }

    return toListItem(row, new Date());
  },

  /**
   * Alterna entre concluida e pendente.
   *
   * Rota propria por ser a acao mais frequente: um clique no checkbox nao
   * deveria exigir que o cliente monte status e data de conclusao.
   */
  async toggleComplete(userId: string, id: string): Promise<AssignmentListItem> {
    const current = await assignmentRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Atividade');

    const isCompleted = current.status === 'COMPLETED';

    const row = await assignmentRepository.update(userId, id, {
      status: isCompleted ? 'PENDING' : 'COMPLETED',
      completedAt: isCompleted ? null : new Date(),
    });

    if (!row) throw AppError.notFound('Atividade');

    return toListItem(row, new Date());
  },

  async remove(userId: string, id: string): Promise<void> {
    // Ver a explicacao em subject.service: os blobs saem antes da cascata.
    await attachmentService.purgeStorageForOwner(userId, { kind: 'assignment', id });

    const deleted = await assignmentRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Atividade');
  },
};
