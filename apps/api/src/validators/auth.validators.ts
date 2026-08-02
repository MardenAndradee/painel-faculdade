import { z } from 'zod';
import { updateProfileSchema } from '@painel/shared';

/**
 * Schemas das rotas de autenticacao.
 *
 * Regras compartilhadas com o frontend vem de `@painel/shared`; aqui ficam
 * apenas as validacoes especificas do transporte HTTP.
 */

export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  /** Presente quando o usuario recusa o consentimento na tela do Google. */
  error: z.string().optional(),
});

export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>;

export const loginQuerySchema = z.object({
  scopes: z
    .enum(['classroom', 'calendar'])
    .optional()
    .transform((value) => (value ? [value] : [])),
});

export { updateProfileSchema };
