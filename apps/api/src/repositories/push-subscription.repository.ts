import { prisma } from '../config/prisma.js';
import { SCANNED_TYPES } from '../utils/notification-rules.js';
import type { NotificationType } from '@painel/shared';

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  userId: string;
}

export interface PushableNotificationRow {
  id: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
}

/** Acesso a dados de Push Notifications (Etapa 28.11). */
export const pushSubscriptionRepository = {
  /**
   * Cria ou reatribui pelo `endpoint` (chave unica): o mesmo navegador pode
   * reaparecer sob outro usuario num aparelho compartilhado, e a
   * re-inscricao deve migrar o dono, nao falhar por conflito.
   */
  upsert(
    userId: string,
    data: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
  ): Promise<PushSubscriptionRow> {
    return prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: { ...data, userId },
      update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent, userId },
    });
  },

  async deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  },

  /** Usada no disparo (R8): apaga uma inscricao morta (404/410), sem depender de conhecer o dono. */
  async deleteById(id: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { id } });
  },

  findByUserId(userId: string): Promise<PushSubscriptionRow[]> {
    return prisma.pushSubscription.findMany({ where: { userId } });
  },

  /** Quem tem ao menos uma inscricao ativa - o universo que o disparo diario varre. */
  async findDistinctUserIds(): Promise<string[]> {
    const rows = await prisma.pushSubscription.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    return rows.map((row) => row.userId);
  },

  /**
   * Notificacoes prontas para virar push: geradas pela mesma varredura do
   * sino (`notificationService.generatePending`), ainda nao empurradas, nao
   * lidas, e so URGENT/ATTENTION - "vence hoje/amanha", nunca "em 3 dias".
   * Restrito aos tipos que a varredura administra (`SCANNED_TYPES`): um tipo
   * futuro que ganhe prioridade alta por engano nao vira push sem revisao
   * explicita deste filtro.
   */
  findPendingByUserId(userId: string): Promise<PushableNotificationRow[]> {
    return prisma.notification.findMany({
      where: {
        userId,
        pushedAt: null,
        readAt: null,
        priority: { in: ['URGENT', 'ATTENTION'] },
        type: { in: SCANNED_TYPES as NotificationType[] },
      },
      select: { id: true, title: true, message: true, entityType: true, entityId: true },
    });
  },

  async markPushed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { pushedAt: new Date() },
    });
  },
};
