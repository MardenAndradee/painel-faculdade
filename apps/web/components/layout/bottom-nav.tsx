'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Menu,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AppModule } from '@painel/shared';
import { useIsModuleEnabled } from '@/hooks/use-module-settings';
import { cn } from '@/lib/utils';

/**
 * Navegação inferior mobile (Etapa 28.8, Decisão #4).
 *
 * Em modo standalone não há barra de endereço - a navegação principal
 * escondida atrás do hambúrguer no topo fica longe do polegar. Os 6 itens
 * são fixos (não vêm de `NAV_SECTIONS`): a lista completa tem mais telas do
 * que cabem numa barra, e aqui só interessam as mais usadas no dia a dia.
 * "Mais" abre a gaveta que já existe, com o resto.
 *
 * Rótulos abreviados de propósito - 6 itens em 360px dão ~60px cada; um
 * rótulo como "Atividades" quebraria linha ou estouraria a coluna.
 */
interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: AppModule;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/turmas', label: 'Turmas', icon: Users, module: 'CLASSES' },
  { href: '/atividades', label: 'Ativid.', icon: ListChecks, module: 'ASSIGNMENTS' },
  { href: '/provas', label: 'Provas', icon: ClipboardList, module: 'EXAMS' },
  { href: '/notas', label: 'Notas', icon: BookOpen, module: 'GRADES' },
];

function BottomNavLink({ item, isActive }: { item: BottomNavItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="size-5" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}

/** Filtra pelos módulos ativos - mesmo critério da Sidebar, sem duplicar o mapeamento. */
function useVisibleBottomNavItems(): BottomNavItem[] {
  // Chamado incondicionalmente para cada módulo possível (regra dos Hooks) -
  // a lista de itens é fixa em tempo de compilação, então o número de
  // chamadas nunca varia entre renders.
  const classesEnabled = useIsModuleEnabled('CLASSES');
  const assignmentsEnabled = useIsModuleEnabled('ASSIGNMENTS');
  const examsEnabled = useIsModuleEnabled('EXAMS');
  const gradesEnabled = useIsModuleEnabled('GRADES');

  const enabledByModule: Partial<Record<AppModule, boolean>> = {
    CLASSES: classesEnabled,
    ASSIGNMENTS: assignmentsEnabled,
    EXAMS: examsEnabled,
    GRADES: gradesEnabled,
  };

  return BOTTOM_NAV_ITEMS.filter((item) => !item.module || enabledByModule[item.module]);
}

/**
 * Barra fixa no rodapé, só abaixo de `lg` (onde a sidebar já é fixa).
 * `env(safe-area-inset-bottom)` evita ficar sob o indicador de gesto do
 * sistema no iOS/Android.
 */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();
  const items = useVisibleBottomNavItems();
  const isMoreActive = items.every(
    (item) => pathname !== item.href && !pathname.startsWith(`${item.href}/`),
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return <BottomNavLink key={item.href} item={item} isActive={isActive} />;
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors',
              isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Menu className="size-5" aria-hidden />
            Mais
          </button>
        </li>
      </ul>
    </nav>
  );
}
