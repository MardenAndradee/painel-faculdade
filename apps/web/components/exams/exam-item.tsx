import { EllipsisVertical, Pencil, Trash2, Weight } from 'lucide-react';
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
import { formatDate, formatGrade } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ExamItemProps {
  exam: ExamListItem;
  onEdit: (exam: ExamListItem) => void;
  onDelete: (exam: ExamListItem) => void;
}

type UrgencyTone = 'danger' | 'warning' | 'info' | 'muted';

/** Faixas de urgencia da contagem regressiva, do modelo do Claude Design. */
function urgencyTone(daysUntilExam: number): UrgencyTone {
  if (daysUntilExam <= 7) return 'danger';
  if (daysUntilExam <= 14) return 'warning';
  if (daysUntilExam <= 21) return 'info';

  return 'muted';
}

const URGENCY_STYLES: Record<UrgencyTone, string> = {
  danger: 'border-status-overdue/25 bg-status-overdue/10 text-status-overdue',
  warning: 'border-status-pending/25 bg-status-pending/10 text-status-pending',
  info: 'border-primary/25 bg-primary/10 text-primary',
  muted: 'border-border bg-muted/40 text-muted-foreground',
};

/** Conteudo do quadrado: dias por extenso quando muito perto, numero caso contrario. */
function countdownContent(daysUntilExam: number): { big: string; small: string | null } {
  if (daysUntilExam === 0) return { big: 'Hoje', small: null };
  if (daysUntilExam === 1) return { big: 'Amanhã', small: null };

  return { big: String(daysUntilExam), small: 'dias restantes' };
}

/**
 * Card de prova.
 *
 * A disciplina fica em destaque no lugar do titulo (removido do formulario);
 * o quadrado a direita mostra a contagem regressiva colorida por urgencia.
 * Provas ja realizadas mostram a nota no lugar da contagem.
 */
export function ExamItem({ exam, onEdit, onDelete }: ExamItemProps) {
  const countdown = countdownContent(exam.daysUntilExam);
  const tone = urgencyTone(exam.daysUntilExam);

  return (
    <li
      className={cn(
        'relative rounded-2xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40',
        exam.isPast && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: exam.subject.color }}
              aria-hidden
            />
            <p className="truncate text-[15px] font-semibold tracking-tight">{exam.subject.name}</p>
          </div>

          {/* O peso vem do componente (Etapa 18) - por isso os dois juntos. */}
          {exam.gradeComponent && (
            <Badge variant="outline" className="mt-2 gap-1">
              <Weight className="size-3" aria-hidden />
              {exam.gradeComponent.name} · peso {exam.gradeComponent.weight}
            </Badge>
          )}

          {exam.content && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{exam.content}</p>
          )}
        </div>

        <div
          className={cn(
            'flex size-[72px] shrink-0 flex-col items-center justify-center rounded-2xl border text-center',
            exam.isPast
              ? exam.grade
                ? 'border-status-completed/25 bg-status-completed/10 text-status-completed'
                : 'border-border bg-muted/40 text-muted-foreground'
              : URGENCY_STYLES[tone],
          )}
          aria-hidden
        >
          {exam.isPast ? (
            exam.grade ? (
              <>
                <span className="text-[11px] opacity-80">Nota</span>
                <span className="text-2xl leading-tight font-semibold tabular-nums">
                  {formatGrade(exam.grade.value)}
                </span>
              </>
            ) : (
              <span className="text-xs">Sem nota</span>
            )
          ) : (
            <>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  countdown.small ? 'text-2xl' : 'text-base',
                )}
              >
                {countdown.big}
              </span>
              {countdown.small && (
                <span className="mt-0.5 text-[10px] opacity-80">{countdown.small}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3.5">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Data
            </p>
            <p className="mt-0.5 text-xs font-medium">{formatDate(exam.date)}</p>
          </div>

          {/* Sem componente nao ha peso: a prova nao entra na media. */}
          {exam.weight !== null && (
            <div>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Peso
              </p>
              <p className="mt-0.5 text-xs font-medium">{exam.weight}</p>
            </div>
          )}

          {exam.room && (
            <div>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Local
              </p>
              <p className="mt-0.5 text-xs font-medium">{exam.room}</p>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label={`Ações da prova de ${exam.subject.name}`}
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
