import {
  buildPaginationMeta,
  type CreateExamInput,
  type ExamCounts,
  type ExamListItem,
  type ExamQuery,
  type PaginatedResult,
  type UpdateExamInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import { examRepository, type ExamListRow } from '../repositories/exam.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { gradeRepository } from '../repositories/grade.repository.js';
import { gradeService } from './grade.service.js';
import { AppError } from '../utils/app-error.js';
import { attachmentService } from './attachment.service.js';
import { emptyToNull } from '../utils/text.js';

/** Regra de negocio de provas. */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Diferenca em dias de calendario, ignorando a hora. */
function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function toListItem(row: ExamListRow, now: Date): ExamListItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    notes: row.notes,
    room: row.room,
    date: row.date.toISOString(),
    // Derivado, nunca armazenado: ver a nota em `ExamListItem.weight`.
    weight: row.gradeComponent?.weight ?? null,
    durationMinutes: row.durationMinutes,
    subject: row.subject,
    daysUntilExam: daysBetween(now, row.date),
    isPast: row.date < now,
    gradeComponent: row.gradeComponent,
    grade: row.grade,
    attachmentCount: row._count.attachments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Confirma que a disciplina existe e pertence ao usuario. */
async function assertSubjectOwnership(userId: string, subjectId: string): Promise<void> {
  const subject = await subjectRepository.findById(userId, subjectId);

  if (!subject) throw AppError.badRequest('Disciplina inválida');
}

/**
 * Lancamento rapido da nota direto no formulario da prova (Etapa 17).
 *
 * `gradeValue` ausente do payload (undefined) nao mexe na nota ja lancada -
 * so um valor explicito (numero ou `null`) altera algo. `null` remove a nota
 * vinculada a esta prova; um numero cria ou atualiza. Reaproveita
 * `gradeService` (nao o repositorio direto) para herdar as mesmas validacoes
 * do lancamento manual: escala, componente valido para a disciplina.
 */
async function syncGrade(
  userId: string,
  exam: { id: string; subjectId: string },
  gradeComponentId: string | null,
  gradeValue: number | null | undefined,
): Promise<void> {
  if (gradeValue === undefined) return;

  const existing = await gradeRepository.findByExam(userId, exam.id);

  if (gradeValue === null) {
    if (existing) await gradeService.remove(userId, existing.id);
    return;
  }

  if (!gradeComponentId) {
    throw AppError.badRequest('Selecione o componente de avaliação para lançar a nota', {
      gradeComponentId: ['Selecione o componente de avaliação'],
    });
  }

  if (existing) {
    await gradeService.update(userId, existing.id, {
      gradeComponentId,
      value: gradeValue,
    });
    return;
  }

  await gradeService.create(userId, {
    subjectId: exam.subjectId,
    gradeComponentId,
    value: gradeValue,
    maxValue: 10,
    examId: exam.id,
    gradedAt: new Date(),
    // Uma prova e uma avaliacao unica, nao um lancamento em partes.
    isFinal: true,
  });
}

export const examService = {
  async list(userId: string, query: ExamQuery): Promise<PaginatedResult<ExamListItem>> {
    const now = new Date();

    const filters = { view: query.view, search: query.search, subjectId: query.subjectId };

    // Peso mora numa relacao opcional (gradeComponent): o Postgres nao tem
    // como colocar NULL sempre no fim independente da direcao quando quem
    // ordena e um campo do lado "um" desse tipo de relacionamento (o
    // `nulls: 'last'` do Prisma so cobre coluna escalar nula, nao um join
    // ausente). Em vez de arriscar "Peso ↓" empurrando provas sem peso pra
    // frente das de peso mais alto, esse caso ordena em memoria.
    if (query.sortBy === 'weight') {
      const all = await examRepository.findAllMatching(userId, filters, now);

      const sorted = [...all].sort((a, b) => {
        const weightA = a.gradeComponent?.weight ?? null;
        const weightB = b.gradeComponent?.weight ?? null;

        if (weightA === null && weightB === null) return 0;
        if (weightA === null) return 1;
        if (weightB === null) return -1;

        return query.order === 'asc' ? weightA - weightB : weightB - weightA;
      });

      const skip = (query.page - 1) * query.perPage;
      const page = sorted.slice(skip, skip + query.perPage);

      return {
        data: page.map((row) => toListItem(row, now)),
        meta: buildPaginationMeta(query.page, query.perPage, sorted.length),
      };
    }

    /**
     * Ordenacao por data.
     *
     * Em "proximas" o padrao e ascendente (a mais proxima primeiro); em
     * "realizadas" faz mais sentido a mais recente primeiro, entao o cliente
     * envia `order=desc`. A regra fica com quem exibe.
     */
    const orderBy: Prisma.ExamOrderByWithRelationInput[] =
      query.sortBy === 'subject'
        ? [{ subject: { name: query.order } }, { date: 'asc' }]
        : query.sortBy === 'title'
          ? [{ title: query.order }]
          : [{ date: query.order }];

    const { rows, total } = await examRepository.findPaginated(
      userId,
      filters,
      orderBy,
      (query.page - 1) * query.perPage,
      query.perPage,
      now,
    );

    return {
      data: rows.map((row) => toListItem(row, now)),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  async counts(userId: string, subjectId?: string): Promise<ExamCounts> {
    return examRepository.countByView(userId, new Date(), { subjectId });
  },

  async getById(userId: string, id: string): Promise<ExamListItem> {
    const row = await examRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Prova');

    return toListItem(row, new Date());
  },

  async create(userId: string, input: CreateExamInput): Promise<ExamListItem> {
    await assertSubjectOwnership(userId, input.subjectId);

    const row = await examRepository.create(userId, {
      // Sem campo de titulo no formulario: o card em destaque usa a disciplina.
      title: input.title?.trim() || 'Avaliação',
      subjectId: input.subjectId,
      date: input.date,
      content: emptyToNull(input.content),
      notes: emptyToNull(input.notes),
      room: emptyToNull(input.room),
      durationMinutes: input.durationMinutes ?? null,
      gradeComponentId: input.gradeComponentId ?? null,
    });

    await syncGrade(
      userId,
      { id: row.id, subjectId: row.subject.id },
      input.gradeComponentId ?? null,
      input.gradeValue,
    );

    return this.getById(userId, row.id);
  },

  async update(userId: string, id: string, input: UpdateExamInput): Promise<ExamListItem> {
    const current = await examRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Prova');

    if (input.subjectId !== undefined) {
      await assertSubjectOwnership(userId, input.subjectId);
    }

    const data: Prisma.ExamUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.content !== undefined ? { content: emptyToNull(input.content) } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
      ...(input.room !== undefined ? { room: emptyToNull(input.room) } : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: input.durationMinutes ?? null }
        : {}),
      ...(input.gradeComponentId !== undefined ? { gradeComponentId: input.gradeComponentId } : {}),
    };

    const row = await examRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Prova');

    const gradeComponentId =
      input.gradeComponentId !== undefined
        ? input.gradeComponentId
        : (current.gradeComponent?.id ?? null);

    await syncGrade(
      userId,
      { id: row.id, subjectId: input.subjectId ?? current.subject.id },
      gradeComponentId,
      input.gradeValue,
    );

    return this.getById(userId, row.id);
  },

  async remove(userId: string, id: string): Promise<void> {
    // Ver a explicacao em subject.service: os blobs saem antes da cascata.
    await attachmentService.purgeStorageForOwner(userId, { kind: 'exam', id });

    const deleted = await examRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Prova');
  },
};
