import webpush from 'web-push';
import type { PushDispatchResult, SubscribePushInput } from '@painel/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { pushSubscriptionRepository } from '../repositories/push-subscription.repository.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../utils/app-error.js';
import { isGoneSubscription } from '../utils/push-errors.js';

/**
 * Push Notifications (Etapa 28.11).
 *
 * Sem worker/fila dedicados - o disparo roda sob demanda quando o Vercel
 * Cron chama `dispatch()` (ver `push.routes.ts`), reaproveitando a mesma
 * `notificationService.generatePending` que a central de notificacoes ja usa
 * sob demanda ao abrir o sino. Uma unica fonte de verdade para "o que deve
 * existir agora" - o push so decide o que, dentre isso, empurrar.
 */

let vapidConfigured = false;

/**
 * As chaves VAPID sao opcionais no boot (ver `env.ts`) - o app inteiro nao
 * deve cair so porque o par ainda nao foi gerado. A falha aparece aqui, na
 * hora de usar, com mensagem clara, em vez de silenciosa.
 */
function ensureVapidConfigured(): void {
  if (vapidConfigured) return;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw AppError.internal(
      'Push Notifications não configurado: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY',
    );
  }

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

export const pushService = {
  async subscribe(
    userId: string,
    input: SubscribePushInput,
    userAgent: string | null,
  ): Promise<void> {
    ensureVapidConfigured();

    await pushSubscriptionRepository.upsert(userId, {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent,
    });
  },

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await pushSubscriptionRepository.deleteByEndpoint(userId, endpoint);
  },

  /**
   * Disparo diario. Varre todo mundo com ao menos uma inscricao, sincroniza
   * as notificacoes pendentes de cada um e empurra as ainda nao enviadas.
   * Uma inscricao que responde 404/410 e apagada na hora (R8) - senao a
   * tabela vira lixo acumulado de aparelhos desinstalados/revogados.
   */
  async dispatch(): Promise<PushDispatchResult> {
    ensureVapidConfigured();

    const userIds = await pushSubscriptionRepository.findDistinctUserIds();

    let usersNotified = 0;
    let pushesSent = 0;
    let subscriptionsRemoved = 0;

    for (const userId of userIds) {
      await notificationService.generatePending(userId);

      const pending = await pushSubscriptionRepository.findPendingByUserId(userId);

      if (pending.length === 0) continue;

      const subscriptions = await pushSubscriptionRepository.findByUserId(userId);

      if (subscriptions.length === 0) continue;

      const deadSubscriptionIds = new Set<string>();
      let anySent = false;

      for (const notification of pending) {
        const payload = JSON.stringify({
          title: notification.title,
          body: notification.message,
          entityType: notification.entityType,
          entityId: notification.entityId,
        });

        for (const subscription of subscriptions) {
          if (deadSubscriptionIds.has(subscription.id)) continue;

          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
            );

            pushesSent += 1;
            anySent = true;
          } catch (error) {
            if (isGoneSubscription(error)) {
              await pushSubscriptionRepository.deleteById(subscription.id);
              deadSubscriptionIds.add(subscription.id);
              subscriptionsRemoved += 1;
              continue;
            }

            logger.warn('Falha ao enviar push', {
              userId,
              subscriptionId: subscription.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      await pushSubscriptionRepository.markPushed(pending.map((notification) => notification.id));

      if (anySent) usersNotified += 1;
    }

    return { usersNotified, pushesSent, subscriptionsRemoved };
  },
};
