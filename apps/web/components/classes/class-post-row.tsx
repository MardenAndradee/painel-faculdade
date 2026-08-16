'use client';

import { MapPin, Trash2 } from 'lucide-react';
import type { ClassPostListItem } from '@painel/shared';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

/** Data de referência de uma publicação, qualquer que seja o `kind`. */
function classPostWhen(post: ClassPostListItem): string | null {
  return post.date ?? post.dueDate ?? post.startsAt ?? null;
}

/** Dias até a data - só para o destaque visual, não para nenhuma regra de negócio. */
function daysUntil(value: string): number {
  const today = new Date();
  const target = new Date(value);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
}

/**
 * Linha de publicação da turma, no padrão visual de `ExamRow`/`AssignmentRow`
 * (Dashboard) - barra de cor da disciplina, título em até 2 linhas, metadados
 * numa metalinha flexível, destaque de urgência para provas próximas.
 */
export function ClassPostRow({
  post,
  onRemove,
}: {
  post: ClassPostListItem;
  onRemove?: (post: ClassPostListItem) => void;
}) {
  const when = classPostWhen(post);
  const isImminentExam = post.kind === 'EXAM' && post.date !== null && daysUntil(post.date) <= 3;

  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
      <span
        className="mt-1 h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: post.classSubject?.color ?? 'var(--muted-foreground)' }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{post.title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {post.classSubject && <span className="truncate">{post.classSubject.name}</span>}

          {when && (
            <>
              <span aria-hidden>·</span>
              <span>{formatDate(when)}</span>
            </>
          )}

          {post.kind === 'EXAM' && post.room && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {post.room}
              </span>
            </>
          )}

          <span aria-hidden>·</span>
          <span>
            {post.copyCount} {post.copyCount === 1 ? 'cópia' : 'cópias'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isImminentExam && (
          <span className="text-xs font-medium whitespace-nowrap text-status-overdue">Próxima</span>
        )}

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={() => onRemove(post)}
            aria-label={`Excluir ${post.title}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}
