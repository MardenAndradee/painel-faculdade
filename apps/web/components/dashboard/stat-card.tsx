import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  /** Destaca o card quando o numero exige atencao (atrasos, por exemplo). */
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

const TONES = {
  default: 'text-muted-foreground',
  warning: 'text-status-pending',
  danger: 'text-status-overdue',
  success: 'text-status-completed',
} as const;

/** Numero em destaque com rotulo e icone. Bloco base das estatisticas rapidas. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default' }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={cn('size-4 shrink-0', TONES[tone])} aria-hidden />
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>

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
