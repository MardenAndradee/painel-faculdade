'use client';

import { useState } from 'react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';

/** "2026-08-14" -> Date em MEIA-NOITE LOCAL. `new Date(string)`/`parseISO` leriam como UTC e a data exibida cairia um dia para trás em fusos negativos. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Normaliza a entrada para `yyyy-MM-dd`.
 *
 * Os schemas de formulario aceitam `string | Date` no campo de data (o
 * schema e usado tambem fora de contexto de formulario HTML) - na pratica,
 * vindo de um input, e sempre string, mas o tipo precisa cobrir os dois.
 */
function toDateOnlyString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  return format(value, 'yyyy-MM-dd');
}

interface DatePickerProps {
  /** Data em `yyyy-MM-dd`/`Date`, ou vazio - mesmo contrato do `<input type="date">` que substitui. */
  value: string | Date | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Selecao de data com calendario proprio, no lugar do popup nativo do navegador. */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'dd/mm/aaaa',
  disabled,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const normalized = toDateOnlyString(value);
  const selected = normalized ? parseDateOnly(normalized) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none',
            'transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            !selected && 'text-muted-foreground',
          )}
          {...aria}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {selected && isValid(selected)
            ? format(selected, 'dd/MM/yyyy', { locale: ptBR })
            : placeholder}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start">
        <Calendar
          selected={selected}
          onSelect={(date) => {
            onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
