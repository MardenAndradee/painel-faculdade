import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  ClipboardList,
  EllipsisVertical,
  ListChecks,
  Pencil,
  Trash2,
  User,
} from 'lucide-react';
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
import { formatGrade } from '@/lib/format';
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

export function SubjectCard({ subject, onEdit, onArchive, onRestore, onDelete }: SubjectCardProps) {
  const isArchived = subject.archivedAt !== null;

  return (
    <Card className={cn('relative overflow-hidden', isArchived && 'opacity-70')}>
      {/* Faixa superior na cor da disciplina: identifica a matéria de relance. */}
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: subject.color }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/disciplinas/${subject.id}`}
              className="rounded text-sm font-semibold transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {subject.name}
            </Link>

            {subject.code && (
              <span className="text-xs text-muted-foreground tabular-nums">{subject.code}</span>
            )}
          </div>

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
              className="size-7 shrink-0"
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

      <div className="flex items-end justify-between gap-3 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListChecks className="size-3.5" aria-hidden />
            <span className="tabular-nums">{subject.assignmentCount}</span>
            <span className="hidden sm:inline">
              {subject.assignmentCount === 1 ? 'atividade' : 'atividades'}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClipboardList className="size-3.5" aria-hidden />
            <span className="tabular-nums">{subject.examCount}</span>
            <span className="hidden sm:inline">{subject.examCount === 1 ? 'prova' : 'provas'}</span>
          </span>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Média</p>
          <p
            className={cn(
              'text-lg leading-tight font-semibold tabular-nums',
              averageTone(subject.average, subject.passingGrade),
            )}
          >
            {formatGrade(subject.average)}
          </p>
        </div>
      </div>

      {(isArchived || subject.status !== 'IN_PROGRESS') && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-5">
          {isArchived && <Badge variant="secondary">Arquivada</Badge>}
          {subject.status !== 'IN_PROGRESS' && (
            <Badge variant={subject.status === 'APPROVED' ? 'completed' : 'overdue'}>
              {SUBJECT_STATUS_LABELS[subject.status]}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
