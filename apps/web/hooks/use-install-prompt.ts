'use client';

import { useCallback, useEffect, useState } from 'react';
import { isIOSUserAgent, resolveInstallCardMode, type InstallCardMode } from '@/lib/install-prompt';

/**
 * `beforeinstallprompt` não é padronizado no lib.dom.d.ts do TypeScript -
 * só Chrome/Edge/outros baseados em Chromium disparam.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_STORAGE_KEY = 'painel-install-dismissed';

function isStandaloneDisplay(): boolean {
  // `navigator.standalone` e a forma que o Safari/iOS usa; a media query e o
  // padrao seguido pelos demais navegadores.
  const nav = navigator as Navigator & { standalone?: boolean };

  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

interface UseInstallPromptResult {
  mode: InstallCardMode;
  /** Dispara o prompt nativo de instalação - só tem efeito quando `mode === 'button'`. */
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

/**
 * Experiência de instalação (Etapa 28.7).
 *
 * `beforeinstallprompt` só existe em navegadores Chromium; guardamos o
 * evento para poder disparar `.prompt()` sob um clique do usuário (o
 * navegador exige um gesto explícito, não pode ser chamado ao montar). O
 * iOS nunca dispara esse evento - é por isso que `resolveInstallCardMode`
 * também recebe `isIOS`, para mostrar instruções manuais nesse caso.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplay());
    setIsIOS(isIOSUserAgent(navigator.userAgent, navigator.maxTouchPoints));
    setDismissed(localStorage.getItem(DISMISSED_STORAGE_KEY) === '1');

    const onBeforeInstallPrompt = (event: Event): void => {
      // Sem isso o Chrome mostra o mini-infobar nativo dele, além do nosso card.
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = (): void => {
      setDeferredEvent(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<void> => {
    if (!deferredEvent) return;

    await deferredEvent.prompt();
    await deferredEvent.userChoice;

    // O evento só pode ser usado uma vez - o Chrome não emite outro até a
    // próxima carga de página que ainda considere o app instalável.
    setDeferredEvent(null);
  }, [deferredEvent]);

  const dismiss = useCallback((): void => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, '1');
    setDismissed(true);
  }, []);

  const mode = resolveInstallCardMode({
    isStandalone,
    isIOS,
    canPromptInstall: deferredEvent !== null,
    dismissed,
  });

  return { mode, promptInstall, dismiss };
}
