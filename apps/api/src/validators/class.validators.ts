import { z } from 'zod';
import { classSubjectInputSchema } from '@painel/shared';

/** Parametros de rota de turmas (Etapa 20). */

export const classIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
});

export const classSubjectIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  subjectId: z.string().min(1, 'Identificador obrigatório'),
});

export const classInviteIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  inviteId: z.string().min(1, 'Identificador obrigatório'),
});

export const classInviteTokenParamSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
});

export const classPostIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  postId: z.string().min(1, 'Identificador obrigatório'),
});

export const upcomingClassPostsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const classAnnouncementIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  announcementId: z.string().min(1, 'Identificador obrigatório'),
});

export const classNoteIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  noteId: z.string().min(1, 'Identificador obrigatório'),
});

export const classMaterialIdParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
  materialId: z.string().min(1, 'Identificador obrigatório'),
});

/** Edicao: todo campo opcional, para o PATCH alterar so o que foi enviado. */
export const updateClassSubjectSchema = classSubjectInputSchema.partial();
