'use client';

import {
  Check,
  EllipsisVertical,
  ExternalLink,
  FileText,
  NotebookPen,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { AssignmentListItem } from '@painel/shared';
import { PRIORITY_LABELS } from '@painel/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatDueLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AssignmentItemProps {
  assignment: AssignmentListItem;
  onToggle: (assignment: AssignmentListItem) => void;
  onEdit: (assignment: AssignmentListItem) => void;
  onDelete: (assignment: AssignmentListItem) => void;
}

const PRIORITY_STYLES: Record<AssignmentListItem['priority'], string> = {
  URGENT: 'bg-status-overdue/15 text-status-overdue',
  HIGH: 'bg-status-pending/15 text-status-pending',
  MEDIUM: 'bg-muted text-muted-foreground',
  LOW: 'bg-muted text-muted-foreground',
};

/** Cada atividade e sua propria linha-cartao, no lugar de uma lista com divisorias. */
export function AssignmentItem({ assignment, onToggle, onEdit, onDelete }: AssignmentItemProps) {
  const isCompleted = assignment.status === 'COMPLETED';

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/25 hover:bg-accent/40',
        isCompleted && 'opacity-60',
      )}
    >
      {/* Checkbox: alvo de toque generoso, essencial no celular. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={isCompleted ? `Reabrir ${assignment.title}` : `Concluir ${assignment.title}`}
        onClick={() => onToggle(assignment)}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
          isCompleted
            ? 'border-status-completed bg-status-completed text-white'
            : 'border-input hover:border-primary',
        )}
      >
        {isCompleted && <Check className="size-3.5" aria-hidden />}
      </button>

      {/* Chip da disciplina: mesma linguagem visual dos cards de Disciplinas e da Dashboard. */}
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={
          assignment.subject
            ? { backgroundColor: `${assignment.subject.color}1f`, color: assignment.subject.color }
            : undefined
        }
        aria-hidden
      >
        <FileText className={cn('size-4', !assignment.subject && 'text-muted-foreground')} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn('text-sm font-medium', isCompleted && 'line-through')}>
            {assignment.title}
          </p>

          {assignment.source === 'GOOGLE_CLASSROOM' && (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              Classroom
            </Badge>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {assignment.subject && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: assignment.subject.color }}
                aria-hidden
              />
              {assignment.subject.name}
            </span>
          )}

          {assignment.dueDate && (
            <>
              {assignment.subject && <span aria-hidden>·</span>}
              <span>{formatDate(assignment.dueDate)}</span>
            </>
          )}

          {assignment.notes && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <NotebookPen className="size-3" aria-hidden />
                Observações
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-1">
          {!isCompleted && (
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap tabular-nums',
                assignment.isOverdue
                  ? 'text-status-overdue'
                  : assignment.daysUntilDue === 0
                    ? 'text-status-pending'
                    : 'text-muted-foreground',
              )}
            >
              {formatDueLabel(assignment.daysUntilDue)}
            </span>
          )}

          {!isCompleted && (assignment.priority === 'URGENT' || assignment.priority === 'HIGH') && (
            <Badge className={cn('gap-1 border-transparent', PRIORITY_STYLES[assignment.priority])}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {PRIORITY_LABELS[assignment.priority]}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={`Ações de ${assignment.title}`}
            >
              <EllipsisVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(assignment)}>
              <Pencil aria-hidden />
              Editar
            </DropdownMenuItem>

            {assignment.classroomLink && (
              <DropdownMenuItem asChild>
                <a href={assignment.classroomLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  Abrir no Classroom
                </a>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => onDelete(assignment)}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
