import { z } from 'zod';
import { SUBJECT_STATUS, type SubjectStatus } from '../enums.js';
import { booleanQueryParam, paginationQuerySchema } from '../common.js';

/**
 * Contrato de disciplinas.
 *
 * O mesmo schema valida o corpo da requisicao no Express e alimenta o React
 * Hook Form no frontend: o formulario nunca aceita algo que a API recusaria.
 */

/** Hexadecimal de 6 digitos, o formato que os inputs de cor produzem. */
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB');

/**
 * Campos da disciplina SEM valores padrao.
 *
 * O `.partial()` do Zod torna os campos opcionais mas NAO remove `.default()`:
 * um PATCH sem `color` receberia a cor padrao e sobrescreveria a escolhida
 * pelo usuario. Por isso a base nao tem defaults - eles entram apenas no
 * schema de criacao.
 */
const subjectBaseSchema = z.object({
  name: z
    .string({ error: 'Informe o nome da disciplina' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),

  code: z
    .string()
    .trim()
    .max(20, 'O código pode ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),

  description: z
    .string()
    .trim()
    .max(1000, 'A descrição pode ter no máximo 1000 caracteres')
    .optional()
    .or(z.literal('')),

  color: hexColorSchema,

  room: z.string().trim().max(60, 'Máximo de 60 caracteres').optional().or(z.literal('')),

  credits: z.coerce
    .number()
    .int('Use um número inteiro')
    .min(0, 'Não pode ser negativo')
    .max(40, 'Valor muito alto')
    .optional(),

  passingGrade: z.coerce.number().min(0, 'Não pode ser negativo').max(10, 'A nota máxima é 10'),

  status: z.enum(SUBJECT_STATUS),

  semesterId: z.string().min(1).nullable().optional(),
  teacherId: z.string().min(1).nullable().optional(),

  /**
   * Cria o professor junto com a disciplina.
   *
   * Existe para evitar que o usuario tenha de sair da tela, cadastrar o
   * professor e voltar. Ignorado quando `teacherId` e informado.
   */
  newTeacherName: z.string().trim().min(2).max(120).optional().or(z.literal('')),
});

/** Criacao: aplica os valores padrao. */
export const createSubjectSchema = subjectBaseSchema.extend({
  color: hexColorSchema.default('#6366f1'),
  passingGrade: z.coerce
    .number()
    .min(0, 'Não pode ser negativo')
    .max(10, 'A nota máxima é 10')
    .default(6),
  status: z.enum(SUBJECT_STATUS).default('IN_PROGRESS'),
});

/**
 * Tipo de SAIDA: campos com `.default()` ja resolvidos. E o que a API recebe.
 */
export type CreateSubjectInput = z.output<typeof createSubjectSchema>;

/**
 * Tipo de ENTRADA: campos com `.default()` continuam opcionais e `coerce`
 * ainda aceita string.
 *
 * E o formato que o React Hook Form manipula enquanto o usuario preenche -
 * usar o tipo de saida no formulario obrigaria a preencher campos que o
 * proprio schema completa.
 */
export type SubjectFormValues = z.input<typeof createSubjectSchema>;

/**
 * Edicao: todo campo opcional e SEM defaults, para que o PATCH altere apenas
 * o que foi enviado de fato.
 */
export const updateSubjectSchema = subjectBaseSchema.partial();

export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

export const SUBJECT_SORT_FIELDS = ['name', 'average', 'createdAt', 'code'] as const;
export type SubjectSortField = (typeof SUBJECT_SORT_FIELDS)[number];

export const subjectQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  semesterId: z.string().min(1).optional(),
  status: z.enum(SUBJECT_STATUS).optional(),
  /** Por padrao arquivadas ficam fora da listagem. */
  includeArchived: booleanQueryParam(false),
  sortBy: z.enum(SUBJECT_SORT_FIELDS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type SubjectQuery = z.infer<typeof subjectQuerySchema>;

/** Professor reduzido ao que a listagem de disciplinas exibe. */
export interface TeacherRef {
  id: string;
  name: string;
  email: string | null;
}

/** Disciplina como aparece na listagem, com números já calculados. */
export interface SubjectListItem {
  id: string;
  name: string;
  code: string | null;
  color: string;
  room: string | null;
  credits: number | null;
  passingGrade: number;
  status: SubjectStatus;
  archivedAt: string | null;
  teacher: TeacherRef | null;
  semester: { id: string; name: string } | null;
  /** Media ponderada das notas, ou null quando nenhuma foi lancada. */
  average: number | null;
  assignmentCount: number;
  pendingAssignmentCount: number;
  examCount: number;
  upcomingExamCount: number;
  gradeCount: number;
  createdAt: string;
}

/** Detalhes completos, usados na tela da disciplina. */
export interface SubjectDetail extends SubjectListItem {
  description: string | null;
  classroomLink: string | null;
  googleCourseId: string | null;
  /** Quanto ainda falta para a media de aprovacao, quando aplicavel. */
  requiredGrade: number | null;
  updatedAt: string;
}

/** Contagem do que seria perdido numa exclusao permanente. */
export interface SubjectDeletionImpact {
  assignments: number;
  exams: number;
  grades: number;
  attachments: number;
  studySessions: number;
  calendarEvents: number;
}

/** Paleta sugerida no seletor de cores da disciplina. */
export const SUBJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
  '#84cc16',
] as const;
