import type { DashboardAssignment } from '@painel/shared';
import { PRIORITY_LABELS } from '@painel/shared';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDueLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Prioridades altas ganham destaque; as demais ficam discretas. */
const PRIORITY_STYLES: Record<DashboardAssignment['priority'], string> = {
  URGENT: 'bg-status-overdue/15 text-status-overdue',
  HIGH: 'bg-status-pending/15 text-status-pending',
  MEDIUM: 'bg-muted text-muted-foreground',
  LOW: 'bg-muted text-muted-foreground',
};

/**
 * Linha de atividade nas listas do dashboard.
 *
 * A barra colorida a esquerda usa a cor da disciplina, permitindo identificar
 * a materia sem ler o texto.
 */
export function AssignmentRow({ assignment }: { assignment: DashboardAssignment }) {
  const isOverdue = assignment.daysUntilDue !== null && assignment.daysUntilDue < 0;
  const isToday = assignment.daysUntilDue === 0;

  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
      <span
        className="mt-1 h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: assignment.subject?.color ?? 'var(--muted-foreground)' }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        {/* Duas linhas em vez de truncar: os cards tem folga vertical, e
            cortar o titulo na primeira linha esconde informacao a toa. */}
        <p className="line-clamp-2 text-sm font-medium">{assignment.title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {assignment.subject && <span className="truncate">{assignment.subject.name}</span>}

          {assignment.dueDate && (
            <>
              <span aria-hidden>·</span>
              <span>{formatDate(assignment.dueDate)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'text-xs font-medium whitespace-nowrap',
            isOverdue && 'text-status-overdue',
            isToday && 'text-status-pending',
            !isOverdue && !isToday && 'text-muted-foreground',
          )}
        >
          {formatDueLabel(assignment.daysUntilDue)}
        </span>

        {(assignment.priority === 'URGENT' || assignment.priority === 'HIGH') && (
          <Badge className={cn('border-transparent', PRIORITY_STYLES[assignment.priority])}>
            {PRIORITY_LABELS[assignment.priority]}
          </Badge>
        )}
      </div>
    </li>
  );
}
