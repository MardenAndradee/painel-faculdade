'use client';

import { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOff } from 'lucide-react';
import type { CalendarItem } from '@painel/shared';
import { CalendarItemChip } from './calendar-item-chip';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';

/**
 * Visoes do calendario.
 *
 * Nenhuma delas usa grade de horas. O padrao de mercado (uma linha por hora)
 * exige altura fixa por faixa, fica ilegivel abaixo de 400px e desperdica
 * espaco: a maior parte dos itens aqui sao entregas com hora simbolica (23h59).
 * As visoes usam listas cronologicas, legiveis em qualquer largura.
 */

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Agrupa os itens por dia.
 *
 * Um item que cobre varios dias entra em cada dia do intervalo - do contrario
 * um evento de tres dias so apareceria no primeiro.
 */
function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();

  for (const item of items) {
    const start = startOfDay(new Date(item.startsAt));
    const end = endOfDay(new Date(item.endsAt));
    const days = end >= start ? eachDayOfInterval({ start, end }) : [start];

    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), item]);
    }
  }

  return map;
}

interface ViewProps {
  reference: Date;
  items: CalendarItem[];
  onSelectItem: (item: CalendarItem) => void;
  onSelectDay: (day: Date) => void;
}

// --- Mês -----------------------------------------------------------------------

const MAX_ITEMS_PER_CELL = 3;
// Abaixo de `sm` a celula do mes mal cabe ~45px de largura - titulo truncado
// vira ilegivel. Decisao #5 do plano de PWA: so um marcador de cor por item,
// sem texto, com toque em qualquer ponto abrindo o dia inteiro.
const MAX_DOTS_MOBILE = 4;

export function MonthView({ reference, items, onSelectItem, onSelectDay }: ViewProps) {
  const byDay = useMemo(() => groupByDay(items), [items]);

  const days = useMemo(() => {
    const start = startOfDay(new Date(reference.getFullYear(), reference.getMonth(), 1));
    const first = new Date(start);
    first.setDate(first.getDate() - first.getDay());

    const last = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay()));

    return eachDayOfInterval({ start: first, end });
  }, [reference]);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="grid grid-cols-7 gap-1.5 pb-2">
        {WEEKDAYS_SHORT.map((label, index) => (
          <div
            key={label}
            className="text-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
            aria-label={label}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{WEEKDAYS_MIN[index]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayItems = byDay.get(format(day, 'yyyy-MM-dd')) ?? [];
          const inMonth = isSameMonth(day, reference);
          const visible = dayItems.slice(0, MAX_ITEMS_PER_CELL);
          const hidden = dayItems.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 transition-colors hover:border-primary/25 hover:bg-accent/40 sm:min-h-28',
                !inMonth && 'border-transparent',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`Ver ${format(day, "d 'de' MMMM", { locale: ptBR })}`}
                className={cn(
                  'self-start rounded px-1 text-xs tabular-nums transition-colors hover:bg-muted',
                  isToday(day) && 'bg-primary font-semibold text-primary-foreground',
                  !inMonth && 'text-muted-foreground/50',
                )}
              >
                {format(day, 'd')}
              </button>

              {/* >= sm: titulo truncado, ate MAX_ITEMS_PER_CELL, com link "+N". */}
              <div className="hidden flex-col gap-1 sm:flex">
                {visible.map((item) => (
                  <CalendarItemChip key={item.key} item={item} onClick={onSelectItem} />
                ))}

                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="px-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    +{hidden} {hidden === 1 ? 'item' : 'itens'}
                  </button>
                )}
              </div>

              {/* < sm: so os marcadores de cor - tocar em qualquer um abre o dia. */}
              {dayItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  aria-label={`${dayItems.length} ${dayItems.length === 1 ? 'item' : 'itens'} em ${format(day, "d 'de' MMMM", { locale: ptBR })}`}
                  className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden"
                >
                  {dayItems.slice(0, MAX_DOTS_MOBILE).map((item) => (
                    <span
                      key={item.key}
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color ?? 'var(--primary)' }}
                      aria-hidden
                    />
                  ))}

                  {dayItems.length > MAX_DOTS_MOBILE && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      +{dayItems.length - MAX_DOTS_MOBILE}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Semana ---------------------------------------------------------------------

export function WeekView({ reference, items, onSelectItem, onSelectDay }: ViewProps) {
  const byDay = useMemo(() => groupByDay(items), [items]);

  const days = useMemo(() => {
    const start = new Date(reference);
    start.setDate(start.getDate() - start.getDay());

    return eachDayOfInterval({
      start: startOfDay(start),
      end: endOfDay(new Date(start.getTime() + 6 * 864e5)),
    });
  }, [reference]);

  return (
    // Sete colunas no desktop; empilhadas no celular, onde colunas de 50px
    // seriam ilegiveis.
    <div className="grid gap-3 md:grid-cols-7 md:gap-2">
      {days.map((day) => {
        const dayItems = byDay.get(format(day, 'yyyy-MM-dd')) ?? [];

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'overflow-hidden rounded-xl border bg-card',
              isToday(day) && 'border-primary/50 bg-primary/5',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className="flex w-full items-center justify-between gap-2 border-b px-2 py-1.5 text-left transition-colors hover:bg-muted/60 md:flex-col md:items-start md:gap-0"
            >
              <span className="text-xs text-muted-foreground">
                {format(day, 'EEEE', { locale: ptBR })}
              </span>
              <span
                className={cn('text-sm font-medium tabular-nums', isToday(day) && 'text-primary')}
              >
                {format(day, "d 'de' MMM", { locale: ptBR })}
              </span>
            </button>

            <div className="space-y-0.5 p-1">
              {dayItems.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs text-muted-foreground">—</p>
              ) : (
                dayItems.map((item) => (
                  <CalendarItemChip key={item.key} item={item} onClick={onSelectItem} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Dia --------------------------------------------------------------------------

export function DayView({ reference, items, onSelectItem }: ViewProps) {
  const dayItems = useMemo(() => {
    const byDay = groupByDay(items);

    return byDay.get(format(reference, 'yyyy-MM-dd')) ?? [];
  }, [items, reference]);

  if (dayItems.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={CalendarOff}
          title="Nada agendado"
          description={`Nenhum compromisso em ${format(reference, "d 'de' MMMM", { locale: ptBR })}.`}
        />
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {dayItems.map((item) => {
        const isMultiDay = !isSameDay(new Date(item.startsAt), new Date(item.endsAt));

        return (
          <li
            key={item.key}
            className="rounded-xl border bg-card p-3 transition-colors hover:border-primary/25 hover:bg-accent/40"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-10 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? 'var(--primary)' }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <CalendarItemChip item={item} onClick={onSelectItem} variant="full" />

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1.5 text-xs text-muted-foreground">
                  <span>
                    {item.allDay
                      ? 'Dia inteiro'
                      : isMultiDay
                        ? `${format(new Date(item.startsAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })} → ${format(new Date(item.endsAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}`
                        : format(new Date(item.startsAt), 'HH:mm', { locale: ptBR })}
                  </span>

                  {item.subject && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{item.subject.name}</span>
                    </>
                  )}

                  {item.location && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{item.location}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
