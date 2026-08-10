import { z } from 'zod';
import type { SubjectRef } from './dashboard.js';

/**
 * Contrato de notas.
 *
 * Uma nota pode existir sozinha (lancamento avulso) ou vinculada a uma prova
 * ja cadastrada - `Grade.examId` e unico, entao a relacao e 1-1.
 *
 * Nao ha mais um `type` fixo (P1/P2/P3/...): toda nota se refere a um
 * `GradeComponent` configurado pelo usuario (ver `grade-configuration.ts`),
 * de onde tambem vem o peso usado no calculo da media.
 */

/** Campos da nota SEM defaults - ver a explicacao em `subject.ts`. */
const gradeBaseSchema = z.object({
  subjectId: z.string({ error: 'Selecione a disciplina' }).min(1, 'Selecione a disciplina'),

  gradeComponentId: z
    .string({ error: 'Selecione o componente de avaliação' })
    .min(1, 'Selecione o componente de avaliação'),

  /** Rotulo livre, util para distinguir varios lancamentos do mesmo componente. */
  label: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),

  value: z.coerce
    .number({ error: 'Informe a nota' })
    .min(0, 'A nota não pode ser negativa')
    .max(1000, 'Valor muito alto'),

  /** Escala da avaliacao. Notas sao normalizadas para 0-10 no calculo. */
  maxValue: z.coerce
    .number()
    .positive('A escala precisa ser maior que zero')
    .max(1000, 'Valor muito alto'),

  /** Prova correspondente, quando a nota vier de uma avaliacao cadastrada. */
  examId: z.string().min(1).nullable().optional(),

  gradedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((value) => {
      if (!value) return undefined;

      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }),

  notes: z.string().trim().max(1000, 'Máximo de 1000 caracteres').optional().or(z.literal('')),

  /**
   * Falso quando o professor ainda vai somar pontos a este componente (um
   * trabalho lancado em partes). Enquanto falso, o componente conta como
   * pendente no calculo da media/nota necessaria, mesmo ja tendo uma nota
   * lancada.
   *
   * Sem default aqui - ver a explicacao em `subject.ts` sobre por que o
   * default mora so no schema de criacao, nunca no de edicao.
   */
  isFinal: z.boolean().optional(),
});

/** Criacao: escala 0-10 por padrao, nota final por padrao. */
export const createGradeSchema = gradeBaseSchema.extend({
  maxValue: z.coerce
    .number()
    .positive('A escala precisa ser maior que zero')
    .max(1000, 'Valor muito alto')
    .default(10),
  isFinal: z.boolean().optional().default(true),
});

export type CreateGradeInput = z.output<typeof createGradeSchema>;
export type GradeFormValues = z.input<typeof createGradeSchema>;

/** Edicao: sem defaults. Um PATCH da nota nao pode resetar a escala. */
export const updateGradeSchema = gradeBaseSchema.partial();
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;

export interface GradeListItem {
  id: string;
  gradeComponent: { id: string; name: string; weight: number };
  label: string | null;
  value: number;
  maxValue: number;
  /** Nota convertida para a escala 0-10, que e como a media e calculada. */
  normalized: number;
  gradedAt: string;
  notes: string | null;
  subject: SubjectRef;
  /** Prova vinculada, quando houver. */
  exam: { id: string; title: string; date: string } | null;
  createdAt: string;
  /** Falso quando ainda faltam pontos a somar neste componente (Etapa 18). */
  isFinal: boolean;
}

/** Situacao de uma disciplina em relacao a aprovacao. */
export type SubjectGradeStatus =
  'SEM_NOTAS' | 'APROVADO' | 'REPROVADO' | 'EM_RECUPERACAO' | 'EM_ANDAMENTO';

export const SUBJECT_GRADE_STATUS_LABELS: Record<SubjectGradeStatus, string> = {
  SEM_NOTAS: 'Sem notas',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  EM_RECUPERACAO: 'Atenção',
  EM_ANDAMENTO: 'Em andamento',
};

/** Boletim de uma disciplina: notas lancadas e projecao de aprovacao. */
export interface SubjectGradeSummary {
  subject: SubjectRef & { passingGrade: number };
  grades: GradeListItem[];
  /** Media ponderada das notas lancadas, na escala 0-10. */
  average: number | null;
  /** Soma dos pesos ja avaliados. */
  usedWeight: number;
  /**
   * Peso ainda por avaliar, deduzido dos componentes configurados sem nota.
   * `null` quando a disciplina nao tem componentes pendentes (ou nenhuma
   * configuracao de notas ainda).
   */
  remainingWeight: number | null;
  /**
   * Nota necessaria no restante para atingir a media de aprovacao.
   *
   * `null` quando nao ha peso restante conhecido; `<= 0` quando a aprovacao
   * ja esta garantida; acima da escala quando ja e inalcancavel.
   */
  requiredGrade: number | null;
  status: SubjectGradeStatus;
  /**
   * Componentes ainda em aberto: sem nenhuma nota lancada, OU com nota
   * lancada mas marcada como nao-final (`isFinal: false` - mais pontos ainda
   * vao somar). Cruze com `grades` para saber qual dos dois casos e cada um.
   */
  pendingComponents: Array<{ id: string; name: string; weight: number }>;
}

/** Visao geral do desempenho, usada na tela de Notas. */
export interface GradesOverview {
  subjects: SubjectGradeSummary[];
  /** Media geral: media simples das medias por disciplina. */
  overallAverage: number | null;
  totalGrades: number;
  subjectsAtRisk: number;
}
