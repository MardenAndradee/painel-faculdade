'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Conteudo da navegacao lateral.
 *
 * Compartilhado entre a sidebar fixa do desktop e o painel deslizante do
 * mobile - o comportamento muda, a lista de links nao.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <GraduationCap className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">Painel Faculdade</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>

            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, stage }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);

                // Telas ainda nao construidas nao viram link: um <span> evita
                // navegar para uma rota que resultaria em 404.
                if (stage) {
                  return (
                    <li key={href}>
                      <span
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground/60"
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
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
