'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const;

/**
 * Alternador de tema.
 *
 * O icone so e decidido apos a montagem: no servidor nao ha como saber a
 * preferencia do sistema, e renderizar um palpite causaria erro de hidratacao.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const CurrentIcon = mounted && resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alternar tema">
          {/* Antes de montar o icone fica invisivel, evitando piscar. */}
          <CurrentIcon className={cn('size-4', !mounted && 'opacity-0')} aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={theme === value ? 'bg-accent' : undefined}
          >
            <Icon aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
