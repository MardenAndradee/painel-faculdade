'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * Conteudo da navegacao lateral.
 *
 * Compartilhado entre a sidebar fixa do desktop e o painel deslizante do
 * mobile - o comportamento muda, a lista de links nao.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_0_1px_rgba(79,124,255,.35),0_6px_18px_-8px_rgba(79,124,255,.9)]">
          <GraduationCap className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight">Painel Faculdade</span>
      </div>

      {user && (
        <div className="mx-3 mb-1 flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
          <Avatar className="size-8 shrink-0">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )}

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
                  <li key={href}>
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
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
