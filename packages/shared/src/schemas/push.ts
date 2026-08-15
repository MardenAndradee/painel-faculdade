import { z } from 'zod';

/**
 * Contrato de Push Notifications (Etapa 28.11).
 *
 * O formato de `endpoint`/`keys` espelha `PushSubscriptionJSON`, o que o
 * navegador devolve de `PushSubscription.toJSON()` - sem reformatar nada no
 * frontend antes de enviar.
 */

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1, 'Chave p256dh ausente'),
  auth: z.string().min(1, 'Chave auth ausente'),
});

export const subscribePushSchema = z.object({
  endpoint: z.string().url('Endpoint inválido'),
  keys: pushSubscriptionKeysSchema,
});

export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url('Endpoint inválido'),
});

export type UnsubscribePushInput = z.infer<typeof unsubscribePushSchema>;

export interface PushDispatchResult {
  usersNotified: number;
  pushesSent: number;
  subscriptionsRemoved: number;
}
