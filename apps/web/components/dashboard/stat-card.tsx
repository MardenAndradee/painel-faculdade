import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  /**
   * Cor do icone. `info`/`violet` sao decorativos (variam a estatistica
   * "rapida" a distancia); `warning`/`danger`/`success` continuam com
   * significado semantico (atencao, atraso, tudo em dia).
   */
  tone?: 'default' | 'info' | 'violet' | 'warning' | 'danger' | 'success';
}

const TONES = {
  default: { icon: 'text-muted-foreground', chip: 'bg-muted' },
  info: { icon: 'text-primary', chip: 'bg-primary/15' },
  violet: { icon: 'text-violet-400', chip: 'bg-violet-400/15' },
  warning: { icon: 'text-status-pending', chip: 'bg-status-pending/15' },
  danger: { icon: 'text-status-overdue', chip: 'bg-status-overdue/15' },
  success: { icon: 'text-status-completed', chip: 'bg-status-completed/15' },
} as const;

/** Numero em destaque com rotulo e icone. Bloco base das estatisticas rapidas. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default' }: StatCardProps) {
  return (
    <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            TONES[tone].chip,
          )}
        >
          <Icon className={cn('size-4', TONES[tone].icon)} aria-hidden />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>

      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-7 w-12" />
      <Skeleton className="mt-2 h-3 w-16" />
    </Card>
  );
}
