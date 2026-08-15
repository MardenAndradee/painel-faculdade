'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useServiceWorkerUpdate } from '@/hooks/use-service-worker-update';

/**
 * Aviso de nova versão do app (Etapa 28.9).
 *
 * Não renderiza nada por si só - só dispara o toast quando
 * `useServiceWorkerUpdate` sinaliza uma atualização de verdade. `duration:
 * Infinity` porque sumir sozinho depois de alguns segundos deixaria quem
 * saiu da tela sem perceber achando que ainda está na versão antiga.
 */
export function ServiceWorkerUpdateToast() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  const shown = useRef(false);

  useEffect(() => {
    if (!updateAvailable || shown.current) return;

    shown.current = true;

    toast.info('Nova versão disponível', {
      description: 'Atualize para pegar as últimas melhorias.',
      duration: Infinity,
      action: {
        label: 'Atualizar',
        onClick: applyUpdate,
      },
    });
  }, [updateAvailable, applyUpdate]);

  return null;
}
