'use client';

import { MapPin, Trash2 } from 'lucide-react';
import type { ClassPostListItem } from '@painel/shared';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/format';

/**
 * Data de referência formatada, qualquer que seja o `kind`. Prova/Atividade
 * são só data (decisão da Etapa 30); Evento com horário marcado (não
 * `allDay`) mostra a hora também - sem isso um evento às 19h aparecia como
 * se fosse o dia inteiro.
 */
function formatPostWhen(post: ClassPostListItem): string | null {
  if (post.kind === 'EVENT') {
    if (!post.startsAt) return null;

    return post.allDay ? formatDate(post.startsAt) : formatDateTime(post.startsAt);
  }

  const value = post.date ?? post.dueDate;

  return value ? formatDate(value) : null;
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
  const when = formatPostWhen(post);
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
              <span>{when}</span>
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
