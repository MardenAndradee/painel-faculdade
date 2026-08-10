import type { DashboardExam } from '@painel/shared';
import { MapPin } from 'lucide-react';
import { formatDate, formatExamLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Linha de prova. Provas em ate 3 dias recebem destaque de urgencia. */
export function ExamRow({ exam }: { exam: DashboardExam }) {
  const isImminent = exam.daysUntilExam <= 3;

  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
      <span
        className="mt-1 h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: exam.subject.color }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{exam.subject.name}</p>

        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{exam.title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDate(exam.date)}</span>

          {exam.room && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {exam.room}
              </span>
            </>
          )}
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-xs font-medium whitespace-nowrap',
          isImminent ? 'text-status-overdue' : 'text-muted-foreground',
        )}
      >
        {formatExamLabel(exam.daysUntilExam)}
      </span>
    </li>
  );
}
