import { CalendarSync, ClipboardList, ListChecks, MapPin } from 'lucide-react';
import type { CalendarItem } from '@painel/shared';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND_ICONS = {
  EXAM: ClipboardList,
  ASSIGNMENT: ListChecks,
  EVENT: MapPin,
} as const;

interface CalendarItemChipProps {
  item: CalendarItem;
  onClick?: (item: CalendarItem) => void;
  /** `compact` cabe nas celulas do mes; `full` e usado em dia e semana. */
  variant?: 'compact' | 'full';
}

/**
 * Item da agenda.
 *
 * A cor vem da disciplina; o icone distingue prova, entrega e evento sem
 * depender apenas de cor - importante para quem nao distingue tonalidades.
 *
 * No `compact` (celula do mes) o fundo ja carrega a cor da disciplina - o
 * ponto de cor fica redundante ali e some, liberando espaco (celula do mes
 * mal cabe ponto + titulo no celular).
 */
export function CalendarItemChip({ item, onClick, variant = 'compact' }: CalendarItemChipProps) {
  // Eventos vindos do Google recebem icone proprio: eles sao somente leitura,
  // e o usuario precisa distinguir antes de tentar editar.
  const isImported = item.source === 'GOOGLE_CALENDAR';
  const Icon = isImported ? CalendarSync : KIND_ICONS[item.kind];
  const color = item.color ?? 'var(--primary)';
  const isClickable = item.kind === 'EVENT' && onClick;
  const tinted = variant === 'compact';

  const content = (
    <>
      {!tinted && (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {/* No celular a celula do mes mal cabe o icone + o titulo; o icone some
          ali e volta a aparecer a partir de `sm`, onde ha espaco. */}
      <Icon
        className={cn('size-3 shrink-0 opacity-70', variant === 'compact' && 'hidden sm:block')}
        aria-hidden
      />
      <span className={cn('min-w-0 flex-1 truncate', item.isCompleted && 'line-through')}>
        {item.title}
      </span>
      {variant === 'full' && !item.allDay && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatTime(item.startsAt)}
        </span>
      )}
    </>
  );

  const className = cn(
    'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors',
    variant === 'compact' ? 'leading-tight' : 'py-1.5',
    item.isCompleted && 'opacity-60',
    isClickable ? 'cursor-pointer' : 'cursor-default',
    tinted ? isClickable && 'hover:brightness-110' : isClickable && 'hover:bg-muted',
  );

  const style = tinted ? { backgroundColor: `${color}1f`, color } : undefined;

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onClick(item)}
        className={className}
        style={style}
        title={isImported ? `${item.title} (do Google Calendar)` : item.title}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={style} title={item.title}>
      {content}
    </div>
  );
}
