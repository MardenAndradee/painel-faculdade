'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

/**
 * Faixa fina avisando que o navegador está sem conexão (Etapa 28.5).
 *
 * Só aparece quando `navigator.onLine` é falso - não tenta adivinhar se a
 * API está de pé, só o estado de rede do sistema operacional. Resolve a
 * maior parte da confusão de "por que isso não está atualizando" sem
 * exigir nenhuma lógica nova em cada tela.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-status-pending/15 px-4 py-1.5 text-xs font-medium text-status-pending"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Sem conexão — mostrando os últimos dados disponíveis
    </div>
  );
}
