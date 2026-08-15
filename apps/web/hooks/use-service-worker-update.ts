'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSerwist } from '@serwist/turbopack/react';
import { isGenuineUpdate } from '@/lib/service-worker-update';

interface UseServiceWorkerUpdateResult {
  updateAvailable: boolean;
  applyUpdate: () => void;
}

/**
 * Detecção de atualização do Service Worker (Etapa 28.9, risco R3).
 *
 * `waiting`: um SW novo terminou de instalar e está esperando para assumir -
 * só sinaliza quando `isGenuineUpdate` confirma que não é a primeira
 * instalação. `applyUpdate` manda `SKIP_WAITING`; o próprio SW já roda
 * `clients.claim()` (`app/sw.ts`), o que dispara `controllerchange` no
 * navegador e, por ele, o evento `controlling` aqui - só então recarregamos,
 * depois que o novo SW já assumiu o controle da página.
 */
export function useServiceWorkerUpdate(): UseServiceWorkerUpdateResult {
  const { serwist } = useSerwist();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!serwist) return;

    const onWaiting = (event: { isUpdate?: boolean }): void => {
      if (isGenuineUpdate(event)) setUpdateAvailable(true);
    };

    const onControlling = (): void => {
      window.location.reload();
    };

    serwist.addEventListener('waiting', onWaiting);
    serwist.addEventListener('controlling', onControlling);

    return () => {
      serwist.removeEventListener('waiting', onWaiting);
      serwist.removeEventListener('controlling', onControlling);
    };
  }, [serwist]);

  const applyUpdate = useCallback((): void => {
    serwist?.messageSkipWaiting();
  }, [serwist]);

  return { updateAvailable, applyUpdate };
}
