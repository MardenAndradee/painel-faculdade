import type { NextFunction, Request, Response } from 'express';
import { classService } from '../services/class.service.js';
import { getAuthUser } from './authenticate.js';

/**
 * Protege rotas de turma (`/classes/:id/...`).
 *
 * Sempre 404 para quem nao e membro ativo - nunca 403. Confirmar que uma
 * turma existe para alguem de fora dela e um vazamento (ver a tabela de
 * vetores no README): 403 diria "existe, mas voce nao pode"; 404 nao diz
 * nada. Anexa o papel em `req.classRole` para as rotas que exigem OWNER.
 */
export async function classGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = getAuthUser(req);
    const classId = req.params.id as string;

    req.classRole = await classService.assertMembership(user.id, classId);
    // Virada automática (Etapa 32) - garante o ciclo em dia com o
    // calendário antes de qualquer rota de turma seguir adiante.
    await classService.ensureCurrentCycle(classId);

    next();
  } catch (error) {
    next(error);
  }
}
