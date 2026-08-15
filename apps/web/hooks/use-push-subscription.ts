'use client';

import { useCallback, useEffect, useState } from 'react';
import { pushService } from '@/services/push.service';
import { urlBase64ToUint8Array } from '@/lib/push-subscription';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushSupportStatus = 'unsupported' | NotificationPermission;

interface UsePushSubscriptionResult {
  status: PushSupportStatus;
  isSubscribed: boolean;
  isBusy: boolean;
  /**
   * Pede permissão e inscreve - só deve ser chamada a partir de uma ação
   * explícita do usuário (Etapa 28.11, risco "permissão negada para
   * sempre"). Nunca chamada ao montar nenhum componente.
   */
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Inscrição de push (Etapa 28.11).
 *
 * `status` reflete `Notification.permission` (ou `'unsupported'` em
 * navegadores/contextos sem a API - Firefox e Chrome desktop têm, iOS só a
 * partir do 16.4 e só com o app instalado). `isSubscribed` é o estado real
 * do `PushManager`, não um valor local guardado - assim uma inscrição
 * revogada pelo navegador por fora do app (ex.: usuário limpou dados do
 * site) aparece correta no próximo carregamento.
 */
export function usePushSubscription(): UsePushSubscriptionResult {
  const [status, setStatus] = useState<PushSupportStatus>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    setStatus(Notification.permission);

    void navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();

      setIsSubscribed(existing !== null);
    });
  }, []);

  const subscribe = useCallback(async (): Promise<void> => {
    if (status === 'unsupported' || !VAPID_PUBLIC_KEY) return;

    setIsBusy(true);

    try {
      const permission = await Notification.requestPermission();

      setStatus(permission);

      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // `Uint8Array` genérico (TS 5.7+) não bate exatamente com o tipo
          // `BufferSource` da lib DOM aqui, embora seja um `BufferSource`
          // válido em runtime - mesmo padrão usado por toda a comunidade
          // Web Push com TypeScript.
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));

      const json = subscription.toJSON();

      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;

      await pushService.subscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setIsSubscribed(true);
    } finally {
      setIsBusy(false);
    }
  }, [status]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (status === 'unsupported') return;

    setIsBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;

        await subscription.unsubscribe();
        await pushService.unsubscribe({ endpoint });
      }

      setIsSubscribed(false);
    } finally {
      setIsBusy(false);
    }
  }, [status]);

  return { status, isSubscribed, isBusy, subscribe, unsubscribe };
}
