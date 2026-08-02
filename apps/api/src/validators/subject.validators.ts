import { z } from 'zod';
import {
  booleanQueryParam,
  createSubjectSchema,
  createTeacherSchema,
  subjectQuerySchema,
  updateSubjectSchema,
  updateTeacherSchema,
} from '@painel/shared';

/**
 * Schemas das rotas de disciplinas e professores.
 *
 * As regras de dominio vem de `@painel/shared` - o frontend valida com os
 * mesmos schemas. Aqui ficam apenas os parametros de rota.
 */

export const idParamSchema = z.object({
  id: z.string().min(1, 'Identificador obrigatório'),
});

/**
 * `?permanent=true` distingue exclusao definitiva de arquivamento.
 *
 * Usa `booleanQueryParam` e nao `z.coerce.boolean()`: este ultimo converteria
 * `"false"` em `true`, apagando permanentemente o que deveria ser arquivado.
 */
export const deleteSubjectQuerySchema = z.object({
  permanent: booleanQueryParam(false),
});

export const teacherQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export {
  createSubjectSchema,
  updateSubjectSchema,
  subjectQuerySchema,
  createTeacherSchema,
  updateTeacherSchema,
};
