'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { BottomNav } from './bottom-nav';
import { Breadcrumbs } from './breadcrumbs';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { CommandPalette } from '@/components/search/command-palette';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { OfflineBanner } from './offline-banner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAutoSync } from '@/hooks/use-auto-sync';

/**
 * Estrutura das telas autenticadas: sidebar + navbar + area de conteudo.
 *
 * Mobile first - a sidebar comeca escondida atras de um Sheet e so vira coluna
 * fixa a partir de `lg`. A navbar e sticky para que a navegacao continue
 * alcancavel em listas longas.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // Sincroniza o Classroom ao abrir o app. Fica AQUI, e nao numa tela
  // especifica, porque o shell monta uma vez e persiste enquanto o usuario
  // navega - entao circular entre telas nao dispara nada de novo.
  useAutoSync();

  /**
   * Atalho global da busca (Etapa 19) - o primeiro do projeto.
   *
   * Registrado aqui pelo mesmo motivo do `useAutoSync`: o shell monta uma vez
   * e sobrevive a navegacao, entao o listener nao e re-registrado a cada tela.
   * `preventDefault` porque ⌘K/Ctrl+K tem uso nativo em alguns navegadores.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      setSearchOpen((current) => !current);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixa: apenas em telas grandes. */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Nao e sticky: rolar a faixa junto do conteudo e uma perda
            aceitavel, e complicaria empilhar dois elementos "sticky top-0"
            sem um sobrepor o outro. O header continua fixo sozinho. */}
        <OfflineBanner />

        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="p-0">
              {/* Exigido pelo Radix para acessibilidade; oculto visualmente. */}
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Breadcrumbs key={pathname} />

          {/* Botao com cara de campo no desktop, so o icone no celular - onde
              nao ha teclado para o atalho. Fica do lado esquerdo, colado nas
              breadcrumbs, e nao junto do grupo de acoes da direita. */}
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar"
            className="hidden h-8 w-56 shrink-0 justify-start gap-2 px-2.5 font-normal text-muted-foreground sm:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left text-[13px]">Buscar...</span>
            <kbd className="rounded border px-1 text-[10px] leading-4">⌘K</kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar"
            className="sm:hidden"
          >
            <Search className="size-5" aria-hidden />
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* `pb-16` reserva o espaco da barra inferior fixa (Etapa 28.8) só
            abaixo de `lg`, onde ela existe - sem isso o fim de listas longas
            ficaria escondido atrás dela. */}
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      </div>

      <BottomNav onOpenMore={() => setMobileOpen(true)} />

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
