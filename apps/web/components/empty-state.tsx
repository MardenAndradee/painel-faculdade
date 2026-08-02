import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio.
 *
 * Uma lista sem itens precisa dizer o que aconteceu e o que fazer a seguir -
 * area em branco parece falha de carregamento.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>

      <p className="text-sm font-medium">{title}</p>

      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
