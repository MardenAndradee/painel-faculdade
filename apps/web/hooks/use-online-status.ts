'use client';

import { useEffect, useState } from 'react';

/**
 * Estado de conexão do navegador (Etapa 28.5).
 *
 * Começa `true`: no primeiro render (inclusive no servidor) não há como
 * saber o estado real, e assumir offline piscaria a faixa de aviso em toda
 * carga de página só para sumir um instante depois.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
