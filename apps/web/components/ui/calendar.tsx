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
import { Button } from './button';
import { cn } from '@/lib/utils';

/**
 * Grade de mes para escolher UM dia.
 *
 * Irma do `MiniCalendar` do dashboard (mesma base: date-fns, grade de 42
 * celulas cobrindo semanas inteiras), mas focada em selecionar uma data para
 * um formulario em vez de navegar eventos - por isso o item selecionado vira
 * preenchido em vez de so marcado com pontos.
 */

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

interface CalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
  /** Mes exibido ao montar. Sem controle externo: o popover remonta o calendario a cada abertura. */
  defaultMonth?: Date;
}

export function Calendar({ selected, onSelect, defaultMonth }: CalendarProps) {
  const [month, setMonth] = useState(() => defaultMonth ?? selected ?? new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });

    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className="w-[272px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </p>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
            role="columnheader"
            aria-label={
              ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][index]
            }
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isSelected = selected !== null && isSameDay(day, selected);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              tabIndex={inMonth ? 0 : -1}
              aria-pressed={isSelected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md text-sm transition-colors',
                inMonth
                  ? 'text-foreground hover:bg-accent'
                  : 'text-muted-foreground/40 hover:bg-accent/50',
                today && !isSelected && 'font-semibold ring-1 ring-primary/50',
                isSelected && 'bg-primary font-semibold text-primary-foreground hover:bg-primary',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
