import { Clock, EllipsisVertical, MapPin, Pencil, Trash2, Weight } from 'lucide-react';
import type { ExamListItem } from '@painel/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateTime, formatExamLabel, formatGrade } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ExamItemProps {
  exam: ExamListItem;
  onEdit: (exam: ExamListItem) => void;
  onDelete: (exam: ExamListItem) => void;
}

/**
 * Linha de prova.
 *
 * Provas em ate 3 dias recebem destaque; as ja realizadas exibem a nota
 * quando houver - e o que torna a lista de realizadas um historico util.
 */
export function ExamItem({ exam, onEdit, onDelete }: ExamItemProps) {
  const isImminent = !exam.isPast && exam.daysUntilExam <= 3;

  return (
    <li
      className={cn(
        'flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
        exam.isPast && 'opacity-75',
      )}
    >
      <span
        className="mt-1 h-10 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: exam.subject.color }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium">{exam.subject.name}</p>
          {exam.weight !== 1 && (
            <Badge variant="outline" className="gap-1">
              <Weight className="size-3" aria-hidden />
              peso {exam.weight}
            </Badge>
          )}
        </div>

        <p className="mt-0.5 text-sm text-muted-foreground">{exam.title}</p>

        {exam.content && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{exam.content}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDateTime(exam.date)}</span>

          {exam.room && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {exam.room}
              </span>
            </>
          )}

          {exam.durationMinutes && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                {exam.durationMinutes} min
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        <div className="text-right">
          {exam.isPast ? (
            exam.grade ? (
              <>
                <p className="text-[11px] text-muted-foreground">Nota</p>
                <p className="text-lg leading-tight font-semibold text-status-completed tabular-nums">
                  {formatGrade(exam.grade.value)}
                </p>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Sem nota</span>
            )
          ) : (
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                isImminent ? 'text-status-overdue' : 'text-muted-foreground',
              )}
            >
              {formatExamLabel(exam.daysUntilExam)}
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Ações de ${exam.title}`}
            >
              <EllipsisVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(exam)}>
              <Pencil aria-hidden />
              Editar
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => onDelete(exam)}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
