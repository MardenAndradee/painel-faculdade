import { prisma } from '../config/prisma.js';

/** Acesso a dados das sessoes de estudo. Cronograma completo na Etapa 14. */

export const studySessionRepository = {
  /**
   * Minutos planejados e efetivamente estudados no periodo.
   *
   * O planejado vem da duracao agendada de cada bloco; como o Prisma nao soma
   * a diferenca entre duas colunas, buscamos os limites e somamos em memoria -
   * o volume por usuario e pequeno.
   */
  async sumMinutes(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ plannedMinutes: number; completedMinutes: number }> {
    const sessions = await prisma.studySession.findMany({
      where: { userId, scheduledStart: { gte: from, lte: to } },
      select: { scheduledStart: true, scheduledEnd: true, actualMinutes: true, status: true },
    });

    let plannedMinutes = 0;
    let completedMinutes = 0;

    for (const session of sessions) {
      const durationMs = session.scheduledEnd.getTime() - session.scheduledStart.getTime();
      const durationMinutes = Math.max(Math.round(durationMs / 60_000), 0);

      plannedMinutes += durationMinutes;

      if (session.status === 'COMPLETED') {
        // `actualMinutes` e opcional: sem preenchimento, assume-se o planejado.
        completedMinutes += session.actualMinutes ?? durationMinutes;
      }
    }

    return { plannedMinutes, completedMinutes };
  },
};
