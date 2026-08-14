'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  NAV_SECTIONS,
  STRUCTURAL_NAV_ITEMS,
  type NavItem,
  type NavSection,
} from '@/lib/navigation';
import { Logo } from '@/components/brand/logo';
import { useModuleSettings } from '@/hooks/use-module-settings';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

/** Um item de navegação - compartilhado entre as seções agrupadas e os itens estruturais. */
function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { href, label, icon: Icon, stage } = item;
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  // Telas ainda nao construidas nao viram link: um <span> evita navegar
  // para uma rota que resultaria em 404.
  if (stage) {
    return (
      <li>
        <span
          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/60"
          title={`Disponível na Etapa ${stage}`}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          <span className="text-[10px] tabular-nums">E{stage}</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )}
      >
        {/* Barra de destaque do item ativo, encostada na borda da sidebar. */}
        {isActive && (
          <span
            className="absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
            aria-hidden
          />
        )}
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </li>
  );
}

/**
 * Filtra os itens pelos módulos ativos e descarta seções que ficaram vazias.
 *
 * Enquanto a lista de módulos ainda não carregou, mostra tudo - evita a
 * Sidebar "piscar" vazia e depois preencher. Um item sem `module` (nenhum
 * hoje, mas a Sidebar já nasce pronta pra isso) nunca é escondido.
 */
function useVisibleSections(): NavSection[] {
  const { data } = useModuleSettings();

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.module) return true;
      if (!data) return true;

      return data.find((entry) => entry.module === item.module)?.enabled ?? true;
    }),
  })).filter((section) => section.items.length > 0);
}

/**
 * Conteudo da navegacao lateral.
 *
 * Compartilhado entre a sidebar fixa do desktop e o painel deslizante do
 * mobile - o comportamento muda, a lista de links nao.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const visibleSections = useVisibleSections();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-5">
        {/* Leva ao dashboard, como se espera da marca no topo da navegação. */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>

      <nav
        className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
        aria-label="Navegação principal"
      >
        <div className="flex-1 space-y-6">
          {visibleSections.map((section) => (
            <div key={section.title}>
              {/* Esconde o título quando sobra 1 item só: um cabeçalho de
                  grupo pra um item embaixo parece mais poluição do que
                  organização (possível simplificação #3 do plano). */}
              {section.items.length > 1 && (
                <p className="px-2 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  {section.title}
                </p>
              )}

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Itens estruturais (Configurações): nunca escondidos por um módulo
            desativado, separados visualmente do resto da navegação. */}
        <Separator className="my-3" />
        <ul className="space-y-0.5">
          {STRUCTURAL_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
