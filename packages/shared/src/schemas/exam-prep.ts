import { z } from 'zod';
import { cuidSchema } from '../common.js';
import { EXAM_PREP_ITEM_STATUS, type AttachmentType, type ExamPrepItemStatus } from '../enums.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato do Plano de Estudos (Etapa 27).
 *
 * Nome interno "ExamPrep", nao "StudyPlan" - esse nome ja pertence ao
 * Cronograma (`study-plan.ts` ao lado). Ver docs/modules/plano-de-estudos.md
 * para a documentacao completa por tras de cada decisao aqui.
 */

export const EXAM_PREP_ITEM_STATUS_LABELS: Record<ExamPrepItemStatus, string> = {
  NOT_STARTED: 'Não iniciado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
};

// --- Criacao do plano ---------------------------------------------------------

/** So o `examId` - todo o resto (disciplina, data, semestre) e herdado por relacao. */
export const createExamPrepSchema = z.object({
  examId: cuidSchema,
});

export type CreateExamPrepInput = z.infer<typeof createExamPrepSchema>;

// --- Conteudos -------------------------------------------------------------------

export const createExamPrepItemSchema = z.object({
  title: z
    .string({ error: 'Informe o item' })
    .trim()
    .min(1, 'Informe o item')
    .max(200, 'O item pode ter no máximo 200 caracteres'),
});

export type CreateExamPrepItemInput = z.infer<typeof createExamPrepItemSchema>;

export const updateExamPrepItemSchema = z.object({
  title: z.string().trim().min(1, 'Informe o item').max(200).optional(),
  status: z.enum(EXAM_PREP_ITEM_STATUS).optional(),
});

export type UpdateExamPrepItemInput = z.infer<typeof updateExamPrepItemSchema>;

/**
 * "Transformar em itens": o aluno decide, o sistema so quebra o texto em
 * linhas - nunca interpreta ou resume (o pedido original proíbe extração
 * automática de conteúdo).
 */
export const bulkCreateExamPrepItemsSchema = z.object({
  titles: z
    .array(z.string().trim().min(1).max(200))
    .min(1, 'Informe ao menos um item')
    .max(50, 'No máximo 50 itens de uma vez'),
});

export type BulkCreateExamPrepItemsInput = z.infer<typeof bulkCreateExamPrepItemsSchema>;

export interface ExamPrepItem {
  id: string;
  title: string;
  status: ExamPrepItemStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// --- Anotacoes -------------------------------------------------------------------

/** Documento do editor: validado apenas como objeto, a forma interna é do Tiptap. */
const examPrepNotesSchema = z.record(z.string(), z.unknown());

export const updateExamPrepNotesSchema = z.object({
  notes: examPrepNotesSchema,
});

export type UpdateExamPrepNotesInput = z.infer<typeof updateExamPrepNotesSchema>;

// --- Materiais -------------------------------------------------------------------

export const addExamPrepMaterialSchema = z.object({
  attachmentId: cuidSchema,
});

export type AddExamPrepMaterialInput = z.infer<typeof addExamPrepMaterialSchema>;

export interface ExamPrepMaterialItem {
  id: string;
  addedAt: string;
  attachment: {
    id: string;
    name: string;
    type: AttachmentType;
    url: string;
    mimeType: string | null;
    isPreviewable: boolean;
  };
}

// --- Leitura ---------------------------------------------------------------------

export interface ExamPrepExamRef {
  id: string;
  title: string;
  date: string;
  content: string | null;
}

export interface ExamPrepSemesterRef {
  id: string;
  name: string;
}

export interface ExamPrepFlashcardSummary {
  deckCount: number;
  cardCount: number;
  masteredCount: number;
}

/** Contadores objetivos de progresso - nunca uma estimativa de "preparação". */
export interface ExamPrepProgress {
  contentsTotal: number;
  contentsDone: number;
  /** contentsDone / contentsTotal. Nulo sem itens. */
  itemsCompletionRate: number | null;
  studiedMinutes: number;
}

/** Sessão `IN_PROGRESS` nascida de "Começar sessão" (Etapa 9), se houver uma agora. */
export interface ExamPrepActiveSession {
  id: string;
  startedAt: string;
}

export interface ExamPrepDetail {
  id: string;
  exam: ExamPrepExamRef;
  subject: SubjectRef;
  semester: ExamPrepSemesterRef | null;
  notes: Record<string, unknown>;
  contents: ExamPrepItem[];
  materials: ExamPrepMaterialItem[];
  /** Materiais que já apontam para esta prova (`Attachment.examId`) e ainda não foram vinculados ao plano. */
  suggestedMaterials: ExamPrepMaterialItem['attachment'][];
  flashcards: ExamPrepFlashcardSummary;
  progress: ExamPrepProgress;
  activeStudySession: ExamPrepActiveSession | null;
  createdAt: string;
  updatedAt: string;
}

/** Contagem do que será perdido, mostrada antes de confirmar a exclusão do plano. */
export interface ExamPrepDeletionPreview {
  deckCount: number;
  cardCount: number;
  itemCount: number;
  materialCount: number;
}
