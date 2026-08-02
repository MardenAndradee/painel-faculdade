'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { Breadcrumbs } from './breadcrumbs';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * Estrutura das telas autenticadas: sidebar + navbar + area de conteudo.
 *
 * Mobile first - a sidebar comeca escondida atras de um Sheet e so vira coluna
 * fixa a partir de `lg`. A navbar e sticky para que a navegacao continue
 * alcancavel em listas longas.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixa: apenas em telas grandes. */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
