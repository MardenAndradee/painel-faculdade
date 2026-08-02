import { z } from 'zod';
import { paginationQuerySchema } from '../common.js';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de flashcards.
 *
 * Um baralho (`Deck`) agrupa cartoes; cada cartao carrega o proprio estado de
 * repeticao espacada. O cliente nunca calcula agendamento - ele envia a nota e
 * recebe de volta quando o cartao vai voltar.
 */

/** Mesma regra de cor usada em disciplinas: hexadecimal de 6 digitos. */
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB');

/** Nota que o aluno da a si mesmo. Os valores seguem o SM-2. */
export const REVIEW_QUALITIES = [0, 3, 4, 5] as const;
export type ReviewQuality = (typeof REVIEW_QUALITIES)[number];

export const REVIEW_QUALITY_LABELS: Record<ReviewQuality, string> = {
  0: 'Errei',
  3: 'Difícil',
  4: 'Bom',
  5: 'Fácil',
};

/** Recortes da lista de cartoes dentro de um baralho. */
export const FLASHCARD_VIEWS = ['todos', 'pendentes', 'novos', 'dominados'] as const;
export type FlashcardView = (typeof FLASHCARD_VIEWS)[number];

export const FLASHCARD_VIEW_LABELS: Record<FlashcardView, string> = {
  todos: 'Todos',
  pendentes: 'Para revisar',
  novos: 'Novos',
  dominados: 'Dominados',
};

// ---------------------------------------------------------------------------
// Baralhos
// ---------------------------------------------------------------------------

/** Campos do baralho SEM defaults - ver a explicacao em `subject.ts`. */
const deckBaseSchema = z.object({
  name: z
    .string({ error: 'Informe o nome do baralho' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),

  description: z
    .string()
    .trim()
    .max(500, 'A descrição pode ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),

  subjectId: z.string().min(1).optional().or(z.literal('')),

  color: hexColorSchema,
});

export const createDeckSchema = deckBaseSchema.extend({
  color: hexColorSchema.default('#6366f1'),
});

export type CreateDeckInput = z.output<typeof createDeckSchema>;
export type DeckFormValues = z.input<typeof createDeckSchema>;

/** Edicao sem defaults: um PATCH do nome nao pode resetar a cor. */
export const updateDeckSchema = deckBaseSchema.partial();
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export const deckQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  subjectId: z.string().min(1).optional(),
});

export type DeckQuery = z.infer<typeof deckQuerySchema>;

// ---------------------------------------------------------------------------
// Cartoes
// ---------------------------------------------------------------------------

/**
 * Campos que o formulario de cartao edita.
 *
 * Exportado porque criar e editar mexem EXATAMENTE nestes campos - o `deckId`
 * da criacao vem da rota, nao de um input. Um schema so evita dois resolvers
 * com formatos diferentes no mesmo formulario.
 */
export const flashcardFormSchema = z.object({
  front: z
    .string({ error: 'Informe a frente do cartão' })
    .trim()
    .min(1, 'Informe a frente do cartão')
    .max(1000, 'A frente pode ter no máximo 1000 caracteres'),

  back: z
    .string({ error: 'Informe o verso do cartão' })
    .trim()
    .min(1, 'Informe o verso do cartão')
    .max(2000, 'O verso pode ter no máximo 2000 caracteres'),

  hint: z
    .string()
    .trim()
    .max(300, 'A dica pode ter no máximo 300 caracteres')
    .optional()
    .or(z.literal('')),
});

export type FlashcardFormFields = z.input<typeof flashcardFormSchema>;

export const createFlashcardSchema = flashcardFormSchema.extend({
  deckId: z.string({ error: 'Selecione o baralho' }).min(1, 'Selecione o baralho'),
});

export type CreateFlashcardInput = z.output<typeof createFlashcardSchema>;
export type FlashcardFormValues = z.input<typeof createFlashcardSchema>;

/** Edicao nao troca o cartao de baralho por acidente: `deckId` fica de fora. */
export const updateFlashcardSchema = flashcardFormSchema.partial();
export type UpdateFlashcardInput = z.infer<typeof updateFlashcardSchema>;

export const flashcardQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  view: z.enum(FLASHCARD_VIEWS).default('todos'),
});

export type FlashcardQuery = z.infer<typeof flashcardQuerySchema>;

/**
 * Criacao em lote.
 *
 * Digitar cartao a cartao num formulario e o maior atrito de um app de
 * flashcards. O formato "pergunta; resposta" por linha resolve o caso comum de
 * quem ja tem a lista pronta no caderno.
 */
export const bulkCreateFlashcardsSchema = z.object({
  deckId: z.string({ error: 'Selecione o baralho' }).min(1, 'Selecione o baralho'),
  cards: z
    .array(flashcardFormSchema)
    .min(1, 'Adicione ao menos um cartão')
    .max(200, 'Envie no máximo 200 cartões por vez'),
});

export type BulkCreateFlashcardsInput = z.infer<typeof bulkCreateFlashcardsSchema>;

/** Avaliacao enviada durante o estudo. */
export const reviewFlashcardSchema = z.object({
  quality: z
    .union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)], {
      error: 'Avaliação inválida',
    })
    .describe('0 errei, 3 difícil, 4 bom, 5 fácil'),

  /** Tempo gasto no cartao. Opcional: nem todo cliente consegue medir. */
  durationMs: z.coerce.number().int().min(0).max(3_600_000).optional(),
});

export type ReviewFlashcardInput = z.infer<typeof reviewFlashcardSchema>;

export const studyQueueQuerySchema = z.object({
  deckId: z.string().min(1).optional(),
  /** Teto de cartoes na sessao, para a fila nao virar uma maratona. */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Inclui cartoes nunca estudados junto dos vencidos. */
  includeNew: z.union([z.boolean(), z.string()]).optional(),
});

export type StudyQueueQuery = z.infer<typeof studyQueueQuerySchema>;

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export interface DeckListItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  subject: SubjectRef | null;
  totalCards: number;
  /** Vencidos + nunca estudados: o numero que o botao "Estudar" mostra. */
  dueCards: number;
  newCards: number;
  /** Cartoes com intervalo longo o bastante para contar como aprendidos. */
  masteredCards: number;
  lastStudiedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardListItem {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint: string | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueDate: string | null;
  lastReviewedAt: string | null;
  totalReviews: number;
  lapses: number;
  /** Verdadeiro quando o cartao esta vencido ou nunca foi estudado. */
  isDue: boolean;
  isNew: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Cartao entregue ao modo de estudo, com a previsao de cada botao. */
export interface StudyCard extends FlashcardListItem {
  deck: { id: string; name: string; color: string };
  /** Intervalo em dias que cada nota aplicaria, para exibir nos botoes. */
  intervalPreview: Record<string, number>;
}

export interface StudyQueue {
  cards: StudyCard[];
  /** Total de vencidos, mesmo alem do limite da sessao. */
  totalDue: number;
  totalNew: number;
}

export interface ReviewResult {
  card: FlashcardListItem;
  /** Quantos cartoes ainda faltam na fila depois deste. */
  remaining: number;
}

export interface FlashcardStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  masteredCards: number;
  /** Revisoes feitas hoje, do log. */
  reviewedToday: number;
  /** Dias seguidos com ao menos uma revisao. */
  streakDays: number;
  /** Acertos sobre o total de revisoes, em porcentagem. Nulo sem revisoes. */
  retentionRate: number | null;
}
