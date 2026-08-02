'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarItem } from '@painel/shared';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Calendario resumido do dashboard.
 *
 * Escrito sob medida em vez de usar react-day-picker: a exigencia aqui e
 * marcar cada dia com pontos nas cores das disciplinas, e adaptar a biblioteca
 * para isso custaria mais que montar a grade de 42 celulas.
 *
 * O calendario completo, com visoes de dia/semana/mes, chega na Etapa 7.
 */

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function MiniCalendar({ events }: { events: CalendarItem[] }) {
  const [referenceMonth, setReferenceMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  /** Agrupa os itens por dia (chave `yyyy-MM-dd`) para consulta direta na grade. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const event of events) {
      const key = format(new Date(event.startsAt), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), event]);
    }

    return map;
  }, [events]);

  // A grade cobre semanas inteiras: dias vizinhos aparecem esmaecidos, evitando
  // buracos no inicio e no fim do mes.
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(referenceMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(referenceMonth), { weekStartsOn: 0 });

    return eachDayOfInterval({ start, end });
  }, [referenceMonth]);

  const selectedEvents = selectedDay
    ? (eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [])
    : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium capitalize">
          {format(referenceMonth, 'MMMM yyyy', { locale: ptBR })}
        </p>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setReferenceMonth((month) => subMonths(month, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setReferenceMonth((month) => addMonths(month, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {WEEKDAYS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="pb-1 text-center text-[11px] font-medium text-muted-foreground"
            role="columnheader"
            aria-label={
              ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][index]
            }
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
          const inMonth = isSameMonth(day, referenceMonth);
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : day)}
              aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${
                dayEvents.length > 0 ? `, ${dayEvents.length} item(ns)` : ''
              }`}
              aria-pressed={isSelected}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors',
                inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                today && 'font-semibold ring-1 ring-primary/40',
                isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {format(day, 'd')}

              {dayEvents.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {/* No maximo tres pontos: alem disso a celula fica ilegivel. */}
                  {dayEvents.slice(0, 3).map((event, index) => (
                    <span
                      key={`${event.id}-${index}`}
                      className="size-1 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? 'currentColor'
                          : (event.color ?? 'var(--primary)'),
                      }}
                      aria-hidden
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
          </p>

          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada agendado neste dia.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedEvents.map((event, index) => (
                <li key={`${event.id}-${index}`} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color ?? 'var(--primary)' }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="text-muted-foreground">
                      {event.kind === 'EXAM'
                        ? 'Prova'
                        : event.kind === 'ASSIGNMENT'
                          ? 'Entrega'
                          : 'Evento'}
                      {!event.allDay && ` · ${formatTime(event.startsAt)}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
