import type { SubscribePushInput, UnsubscribePushInput } from '@painel/shared';
import { httpClient } from './http-client';

/** Etapa 28.11. */
export const pushService = {
  subscribe(input: SubscribePushInput): Promise<void> {
    return httpClient.post<void>('/push/subscribe', input);
  },

  unsubscribe(input: UnsubscribePushInput): Promise<void> {
    return httpClient.post<void>('/push/unsubscribe', input);
  },
};
