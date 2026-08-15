'use client';

import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { LogoMark } from '@/components/brand/logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Card "Instalar aplicativo" (Etapa 28.7).
 *
 * Três estados, cobertos por `useInstallPrompt`/`resolveInstallCardMode`:
 * some quando já instalado ou dispensado; mostra um botão real quando o
 * Chrome/Edge dispararam `beforeinstallprompt`; mostra instruções manuais no
 * iOS, que nunca dispara esse evento. Em qualquer outro navegador (ex.:
 * Firefox desktop), não renderiza nada - nunca um botão que não funciona.
 */
export function InstallAppCard() {
  const { mode, promptInstall, dismiss } = useInstallPrompt();

  if (mode === 'hidden') return null;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-primary/5">
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute top-2 right-2 size-7 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </Button>

      <CardContent className="flex items-center gap-4 py-5 pr-10">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
          <LogoMark className="size-6" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Instalar aplicativo</p>
          <p className="text-sm text-muted-foreground">
            {mode === 'button' ? (
              'Acesse o Painel direto da tela inicial, com abertura mais rápida.'
            ) : (
              <>
                No iPhone/iPad: toque em <Share className="inline size-3.5" aria-hidden /> e depois
                em &quot;Adicionar à Tela de Início&quot;.
              </>
            )}
          </p>
        </div>

        {mode === 'button' && (
          <Button size="sm" onClick={() => void promptInstall()} className="shrink-0">
            <Download className="size-4" aria-hidden />
            Instalar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
