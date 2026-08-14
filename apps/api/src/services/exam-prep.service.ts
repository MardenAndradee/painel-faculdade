import type {
  AddExamPrepMaterialInput,
  BulkCreateExamPrepItemsInput,
  CreateExamPrepItemInput,
  ExamPrepDeletionPreview,
  ExamPrepDetail,
  ExamPrepItem,
  ExamPrepMaterialItem,
  ExamPrepProgress,
  UpdateExamPrepItemInput,
  UpdateExamPrepNotesInput,
} from '@painel/shared';
import type { Prisma } from '../config/prisma.js';
import {
  examPrepRepository,
  type ExamPrepDetailRow,
} from '../repositories/exam-prep.repository.js';
import { examRepository } from '../repositories/exam.repository.js';
import { attachmentRepository } from '../repositories/attachment.repository.js';
import { isPreviewable } from '../utils/attachment-content.js';
import { MASTERED_INTERVAL_DAYS } from './deck.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * Regra de negocio do Plano de Estudos (Etapa 27).
 *
 * Nome interno "ExamPrep" - ver o comentario no schema.prisma sobre por que
 * nao e "StudyPlan" (colide com o Cronograma). Rotulo em portugues: "Plano
 * de Estudos".
 */

function toItem(row: ExamPrepDetailRow['items'][number]): ExamPrepItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMaterialItem(row: ExamPrepDetailRow['materials'][number]): ExamPrepMaterialItem {
  return {
    id: row.id,
    addedAt: row.addedAt.toISOString(),
    attachment: {
      id: row.attachment.id,
      name: row.attachment.name,
      type: row.attachment.type,
      url: row.attachment.url,
      mimeType: row.attachment.mimeType,
      isPreviewable: isPreviewable(row.attachment.mimeType),
    },
  };
}

function computeProgress(row: ExamPrepDetailRow): ExamPrepProgress {
  const contentsDone = row.items.filter((item) => item.status === 'DONE').length;

  const studiedMinutes = row.studySessions
    .filter((session) => session.status === 'COMPLETED')
    .reduce((total, session) => total + (session.actualMinutes ?? 0), 0);

  return {
    contentsTotal: row.items.length,
    contentsDone,
    itemsCompletionRate: row.items.length > 0 ? contentsDone / row.items.length : null,
    studiedMinutes,
  };
}

async function toDetail(userId: string, row: ExamPrepDetailRow): Promise<ExamPrepDetail> {
  const linkedAttachmentIds = new Set(row.materials.map((material) => material.attachment.id));

  // Materiais que ja apontam pra esta prova (Attachment.examId) e ainda nao
  // foram vinculados ao plano - sugestao de um clique na criacao/tela do plano.
  const examAttachments = await attachmentRepository.findByExamId(userId, row.exam.id);
  const suggestedMaterials = examAttachments
    .filter((attachment) => !linkedAttachmentIds.has(attachment.id))
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      url: attachment.url,
      mimeType: attachment.mimeType,
      isPreviewable: isPreviewable(attachment.mimeType),
    }));

  const cardCount = row.decks.reduce((total, deck) => total + deck._count.cards, 0);
  const masteredCount = row.decks.reduce(
    (total, deck) =>
      total + deck.cards.filter((card) => card.intervalDays >= MASTERED_INTERVAL_DAYS).length,
    0,
  );

  return {
    id: row.id,
    exam: {
      id: row.exam.id,
      title: row.exam.title,
      date: row.exam.date.toISOString(),
      content: row.exam.content,
    },
    subject: {
      id: row.exam.subject.id,
      name: row.exam.subject.name,
      color: row.exam.subject.color,
    },
    semester: row.exam.subject.semester
      ? { id: row.exam.subject.semester.id, name: row.exam.subject.semester.name }
      : null,
    notes: row.notes as Record<string, unknown>,
    contents: row.items.map(toItem),
    materials: row.materials.map(toMaterialItem),
    suggestedMaterials,
    flashcards: {
      deckCount: row.decks.length,
      cardCount,
      masteredCount,
    },
    progress: computeProgress(row),
    activeStudySession: (() => {
      const active = row.studySessions.find((session) => session.status === 'IN_PROGRESS');

      return active ? { id: active.id, startedAt: active.scheduledStart.toISOString() } : null;
    })(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const examPrepService = {
  async create(userId: string, examId: string): Promise<ExamPrepDetail> {
    const exam = await examRepository.findById(userId, examId);

    if (!exam) throw AppError.badRequest('Prova inválida');

    const existing = await examPrepRepository.findByExamId(userId, examId);

    if (existing) throw AppError.conflict('Esta prova já tem um plano de estudos');

    const created = await examPrepRepository.create(userId, examId);

    return this.getById(userId, created.id);
  },

  async getById(userId: string, id: string): Promise<ExamPrepDetail> {
    const row = await examPrepRepository.findDetailById(userId, id);

    if (!row) throw AppError.notFound('Plano de estudos');

    return toDetail(userId, row);
  },

  // --- Anotacoes (Etapa 6) ----------------------------------------------------------

  async updateNotes(userId: string, id: string, input: UpdateExamPrepNotesInput): Promise<void> {
    const updated = await examPrepRepository.updateNotes(
      userId,
      id,
      input.notes as Prisma.InputJsonValue,
    );

    if (!updated) throw AppError.notFound('Plano de estudos');
  },

  // --- Conteudos (Etapa 5) ----------------------------------------------------------

  async createItem(
    userId: string,
    examPrepId: string,
    input: CreateExamPrepItemInput,
  ): Promise<ExamPrepDetail> {
    const plan = await examPrepRepository.findRefById(userId, examPrepId);

    if (!plan) throw AppError.notFound('Plano de estudos');

    const order = await examPrepRepository.countItems(examPrepId);

    await examPrepRepository.createItem(examPrepId, { title: input.title, order });

    return this.getById(userId, examPrepId);
  },

  /**
   * "Transformar em itens" (§4 do plano): o aluno decidiu que aquelas linhas
   * viram itens - o sistema so quebra o texto, nunca interpreta ou resume.
   */
  async bulkCreateItems(
    userId: string,
    examPrepId: string,
    input: BulkCreateExamPrepItemsInput,
  ): Promise<ExamPrepDetail> {
    const plan = await examPrepRepository.findRefById(userId, examPrepId);

    if (!plan) throw AppError.notFound('Plano de estudos');

    await examPrepRepository.bulkCreateItems(examPrepId, input.titles);

    return this.getById(userId, examPrepId);
  },

  async updateItem(userId: string, itemId: string, input: UpdateExamPrepItemInput): Promise<void> {
    const updated = await examPrepRepository.updateItem(userId, itemId, input);

    if (!updated) throw AppError.notFound('Item do plano');
  },

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const deleted = await examPrepRepository.deleteItem(userId, itemId);

    if (!deleted) throw AppError.notFound('Item do plano');
  },

  // --- Materiais (Etapa 7) -----------------------------------------------------------

  /**
   * Referencia um material JA EXISTENTE - nunca duplica o arquivo, nunca move
   * o vinculo que ele ja tem (disciplina/atividade/prova/solto).
   */
  async addMaterial(
    userId: string,
    examPrepId: string,
    input: AddExamPrepMaterialInput,
  ): Promise<ExamPrepDetail> {
    const plan = await examPrepRepository.findRefById(userId, examPrepId);

    if (!plan) throw AppError.notFound('Plano de estudos');

    const attachment = await attachmentRepository.findById(userId, input.attachmentId);

    if (!attachment) throw AppError.badRequest('Material inválido');

    const existingLink = await examPrepRepository.findMaterialLink(examPrepId, input.attachmentId);

    if (existingLink) throw AppError.conflict('Este material já está vinculado ao plano');

    await examPrepRepository.addMaterial(examPrepId, input.attachmentId);

    return this.getById(userId, examPrepId);
  },

  async removeMaterial(userId: string, materialId: string): Promise<void> {
    const deleted = await examPrepRepository.deleteMaterial(userId, materialId);

    if (!deleted) throw AppError.notFound('Material do plano');
  },

  // --- Exclusao (Etapa 12) -----------------------------------------------------------

  async getDeletionPreview(userId: string, id: string): Promise<ExamPrepDeletionPreview> {
    const preview = await examPrepRepository.getDeletionPreview(userId, id);

    if (!preview) throw AppError.notFound('Plano de estudos');

    return preview;
  },

  /**
   * Exclui o plano. `ExamPrepItem`/`ExamPrepMaterial`/`Deck` (deste plano)
   * saem em cascata pelo próprio banco; `StudySession.examPrepId` vira
   * `null` também pelo banco (`onDelete: SetNull`) - o minuto já contado nas
   * Estatísticas não some. Nada disso precisa de lógica aqui além de apagar
   * a linha.
   */
  async remove(userId: string, id: string): Promise<void> {
    const deleted = await examPrepRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Plano de estudos');
  },
};
