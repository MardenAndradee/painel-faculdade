import { z } from 'zod';
import { cuidSchema } from '../common.js';
import type { ClassRole } from '../enums.js';

/**
 * Contrato de turmas (Etapa 20).
 *
 * Publicacao + copia (fan-out): a turma guarda o registro canonico e cada
 * membro recebe copias pessoais ao entrar. Ver "## Turmas" no README.
 */

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB');

const DEFAULT_CLASS_COLOR = '#4f7cff';
const DEFAULT_SUBJECT_COLOR = '#6366f1';

/** Disciplina informada na criacao da turma ou adicionada depois. */
export const classSubjectInputSchema = z.object({
  name: z
    .string({ error: 'Informe o nome da disciplina' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),
  code: z.string().trim().max(20).optional().or(z.literal('')),
  color: hexColorSchema.default(DEFAULT_SUBJECT_COLOR),
  teacherName: z.string().trim().max(120).optional().or(z.literal('')),
  credits: z.coerce.number().int().min(0).max(40).optional(),
  /**
   * Presente quando o dono escolheu uma disciplina PESSOAL já existente em
   * vez de digitar uma nova (Etapa 24.1) - o id da `Subject` dele mesmo.
   * O service vincula direto por id, sem depender do casamento por nome.
   */
  existingSubjectId: cuidSchema.optional(),
});

export type ClassSubjectInput = z.output<typeof classSubjectInputSchema>;
export type ClassSubjectFormValues = z.input<typeof classSubjectInputSchema>;

const classBaseSchema = z.object({
  name: z
    .string({ error: 'Informe o nome da turma' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),

  year: z.coerce
    .number({ error: 'Informe o ano' })
    .int('Use um ano válido')
    .min(2000, 'Ano muito antigo')
    .max(2100, 'Ano muito distante'),

  /** Metade do ano civil - "semestre" na nomenclatura do curso, não confundir com "período" (acumulado desde o ingresso). */
  term: z.coerce
    .number({ error: 'Informe o semestre' })
    .int()
    .min(1, 'O semestre é 1 ou 2')
    .max(2, 'O semestre é 1 ou 2'),

  description: z.string().trim().max(1000).optional().or(z.literal('')),
  color: hexColorSchema,
});

export const createClassSchema = classBaseSchema.extend({
  color: hexColorSchema.default(DEFAULT_CLASS_COLOR),
  /** Disciplinas iniciais - a turma pode nascer vazia e ganhar depois. */
  subjects: z.array(classSubjectInputSchema).max(40).default([]),
});

export type CreateClassInput = z.output<typeof createClassSchema>;
export type ClassFormValues = z.input<typeof createClassSchema>;

export const updateClassSchema = classBaseSchema.partial();
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

/**
 * Criacao de convite.
 *
 * `expiresInDays`/`maxUses` ausentes = sem limite naquele eixo. O teto de 100
 * membros por turma (restricao de infraestrutura do *fan-out*) e aplicado
 * pelo service, nao aqui.
 */
export const createClassInviteSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  maxUses: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateClassInviteInput = z.infer<typeof createClassInviteSchema>;

/** Transferência de propriedade (Etapa 24): o novo dono precisa já ser membro ativo. */
export const transferClassOwnerSchema = z.object({
  newOwnerUserId: cuidSchema,
});

export type TransferClassOwnerInput = z.infer<typeof transferClassOwnerSchema>;

// --- Leitura -------------------------------------------------------------------

/** Turma como aparece na listagem "minhas turmas". */
export interface ClassSummary {
  id: string;
  name: string;
  year: number;
  term: number;
  color: string;
  archivedAt: string | null;
  myRole: ClassRole;
  memberCount: number;
  subjectCount: number;
  createdAt: string;
}

export interface ClassSubjectItem {
  id: string;
  name: string;
  code: string | null;
  color: string;
  teacherName: string | null;
  credits: number | null;
  order: number;
  /** Quantos membros já vincularam uma disciplina própria a este molde. */
  linkedMemberCount: number;
}

export interface ClassMemberItem {
  id: string;
  role: ClassRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface ClassDetail {
  id: string;
  name: string;
  year: number;
  term: number;
  description: string | null;
  color: string;
  archivedAt: string | null;
  myRole: ClassRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  subjects: ClassSubjectItem[];
  /** Ids das disciplinas PESSOAIS do usuário atual já vinculadas a alguma
   * disciplina-molde desta turma - usado pra não oferecer de novo no
   * seletor "já tenho essa disciplina" (evita vínculo duplicado). */
  myLinkedSubjectIds: string[];
}

/** Convite recem-criado: única vez em que o token puro trafega. */
export interface ClassInviteCreated {
  id: string;
  token: string;
  joinUrl: string;
  expiresAt: string | null;
  maxUses: number | null;
}

export interface ClassInviteItem {
  id: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
}

/** O que a tela de "entrar" mostra ANTES de confirmar. */
export interface ClassInvitePreview {
  class: {
    id: string;
    name: string;
    year: number;
    term: number;
    color: string;
  };
  owner: { name: string };
  memberCount: number;
  subjectCount: number;
  /** Verdadeiro quando o usuário autenticado já é membro ativo. */
  alreadyMember: boolean;
}

/** Resultado de entrar na turma: o que foi montado automaticamente. */
export interface JoinClassResult {
  class: ClassDetail;
  semester: { id: string; name: string };
  subjectsLinked: number;
  subjectsCreated: number;
}

export const CLASS_ROLE_LABELS: Record<ClassRole, string> = {
  OWNER: 'Dono',
  MEMBER: 'Membro',
};

/**
 * Painel de saúde da turma (Etapa 24): diagnóstico só de leitura para o dono.
 *
 * Os três sinais apontam para o mesmo tipo de problema - um membro ficou
 * para trás do que a turma tem hoje - por causas diferentes: nunca recebeu o
 * vínculo, arquivou a disciplina vinculada depois, ou entrou/existia quando
 * uma publicação não alcançou todo mundo.
 */
export interface ClassHealthSummary {
  /** Membros ativos com pelo menos uma disciplina da turma sem vínculo pessoal. */
  membersWithMissingLinks: number;
  /** Vínculos que apontam para uma `Subject` que o membro arquivou depois. */
  archivedLinkedSubjects: number;
  /** Publicações cujo nº de cópias é menor que o de membros ativos. */
  postsWithIncompleteFanOut: Array<{ id: string; title: string; copyCount: number }>;
}
