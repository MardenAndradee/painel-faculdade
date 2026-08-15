import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

/**
 * Página offline (Etapa 28.5).
 *
 * Servida pelo Service Worker (`app/sw.ts`, `fallbacks`) quando uma
 * navegação falha por falta de rede e a rota não tinha sido visitada antes -
 * sem isso, o navegador mostraria o erro genérico "sem conexão" dele mesmo,
 * sem nenhuma marca do app nem caminho de volta.
 *
 * Página estática de propósito: nenhum dado, nenhuma chamada à API - o
 * ponto dela é funcionar justamente quando a rede não funciona.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
      <Logo markClassName="size-12" className="flex-col gap-3 text-lg" />

      <div className="mt-8 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-6" aria-hidden />
      </div>

      <h1 className="mt-4 text-lg font-semibold tracking-tight">Você está offline</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Sem conexão agora. Telas que você já abriu antes — como Atividades e Provas — podem
        continuar disponíveis.
      </p>

      <Button asChild className="mt-6">
        <Link href="/dashboard">Ir para o Painel</Link>
      </Button>
    </main>
  );
}
