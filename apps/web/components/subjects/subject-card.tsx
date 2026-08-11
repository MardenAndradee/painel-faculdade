import Link from 'next/link';
import { Archive, ArchiveRestore, EllipsisVertical, Pencil, Trash2, User } from 'lucide-react';
import type { SubjectListItem } from '@painel/shared';
import { SUBJECT_STATUS_LABELS } from '@painel/shared';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatGrade, subjectInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SubjectCardProps {
  subject: SubjectListItem;
  onEdit: (subject: SubjectListItem) => void;
  onArchive: (subject: SubjectListItem) => void;
  onRestore: (subject: SubjectListItem) => void;
  onDelete: (subject: SubjectListItem) => void;
}

/** Cor da média conforme a nota de aprovação da própria disciplina. */
function averageTone(average: number | null, passingGrade: number): string {
  if (average === null) return 'text-muted-foreground';
  if (average >= passingGrade) return 'text-status-completed';
  if (average >= passingGrade - 2) return 'text-status-pending';

  return 'text-status-overdue';
}

/**
 * Percentual de atividades concluídas.
 *
 * Derivado do que a listagem já traz (assignmentCount/pendingAssignmentCount)
 * - nao e uma nova chamada, so uma leitura diferente do mesmo dado.
 */
function completionPercent(subject: SubjectListItem): number | null {
  if (subject.assignmentCount === 0) return null;

  const done = subject.assignmentCount - subject.pendingAssignmentCount;

  return Math.round((done / subject.assignmentCount) * 100);
}

export function SubjectCard({ subject, onEdit, onArchive, onRestore, onDelete }: SubjectCardProps) {
  const isArchived = subject.archivedAt !== null;
  const pct = completionPercent(subject);

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40',
        isArchived && 'opacity-70',
      )}
    >
      {/* Faixa superior na cor da disciplina: identifica a matéria de relance. */}
      <span
        className="absolute inset-x-0 top-0 h-0.5 opacity-90"
        style={{ backgroundColor: subject.color }}
        aria-hidden
      />

      <div className="flex items-start gap-3 p-5 pb-0">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
          style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
          aria-hidden
        >
          {subjectInitials(subject.name, subject.code)}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            href={`/disciplinas/${subject.id}`}
            className="rounded text-sm font-medium tracking-tight transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {subject.name}
          </Link>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{subject.teacher?.name ?? 'Sem professor'}</span>
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label={`Ações de ${subject.name}`}
            >
              <EllipsisVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(subject)}>
              <Pencil aria-hidden />
              Editar
            </DropdownMenuItem>

            {isArchived ? (
              <DropdownMenuItem onClick={() => onRestore(subject)}>
                <ArchiveRestore aria-hidden />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(subject)}>
                <Archive aria-hidden />
                Arquivar
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => onDelete(subject)}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Média
            </p>
            <p
              className={cn(
                'text-base leading-tight font-semibold tabular-nums',
                averageTone(subject.average, subject.passingGrade),
              )}
            >
              {formatGrade(subject.average)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Atividades
            </p>
            <p className="text-base leading-tight font-semibold tabular-nums">
              {subject.assignmentCount}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Provas
            </p>
            <p className="text-base leading-tight font-semibold tabular-nums">
              {subject.examCount}
            </p>
          </div>
        </div>

        {pct !== null && <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>}
      </div>

      <div className="px-5 pt-3 pb-5">
        {pct !== null && (
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full opacity-85"
              style={{ width: `${pct}%`, backgroundColor: subject.color }}
            />
          </div>
        )}

        {(isArchived || subject.status !== 'IN_PROGRESS') && (
          <div className={cn('flex flex-wrap gap-1.5', pct !== null && 'mt-3')}>
            {isArchived && <Badge variant="secondary">Arquivada</Badge>}
            {subject.status !== 'IN_PROGRESS' && (
              <Badge variant={subject.status === 'APPROVED' ? 'completed' : 'overdue'}>
                {SUBJECT_STATUS_LABELS[subject.status]}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
