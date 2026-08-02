'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { findNavItem } from '@/lib/navigation';

/**
 * Trilha de navegacao.
 *
 * Deriva do pathname em vez de exigir que cada pagina declare a sua trilha:
 * uma tela nova entra automaticamente ao ser registrada em `NAV_SECTIONS`.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  if (!current) return null;

  const isRoot = pathname === current.href;

  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        <li className="hidden sm:block">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Início
          </Link>
        </li>

        <li className="hidden sm:block" aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>

        <li className="truncate">
          {isRoot ? (
            <span className="font-medium text-foreground">{current.label}</span>
          ) : (
            <Link href={current.href} className="transition-colors hover:text-foreground">
              {current.label}
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}
