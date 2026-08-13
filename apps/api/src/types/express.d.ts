/**
 * Extensao do Request do Express.
 *
 * `user` e populado pelo middleware `authenticate`. Declarado como opcional
 * porque rotas publicas nao passam por ele; os handlers protegidos usam o
 * helper `getAuthUser`, que estreita o tipo e falha alto caso o middleware
 * tenha sido esquecido na rota.
 */
import type { ClassRole } from '@painel/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      /** Populado pelo `classGuard` (Etapa 20) para rotas de turma. */
      classRole?: ClassRole;
    }
  }
}

export {};
