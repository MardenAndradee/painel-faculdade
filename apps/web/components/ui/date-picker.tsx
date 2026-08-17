'use client';

import { useEffect, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
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

function formatDisplay(date: Date | null): string {
  return date && isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
}

/** "dd/mm/aaaa" completo e valido -> Date; incompleto ou invalido -> null. */
function parseTypedDate(text: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;

  const parsed = parse(text, 'dd/MM/yyyy', new Date());

  return isValid(parsed) ? parsed : null;
}

/** So digitos, com as barras inseridas conforme digita: "01012026" -> "01/01/2026". */
function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('/');
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

/**
 * Data com calendario proprio (no lugar do popup nativo do navegador) E
 * digitacao manual - o calendario e uma forma de preencher, nao a unica.
 */
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

  // Texto digitavel livremente, sincronizado com o valor externo quando ele
  // muda por fora (selecao no calendario, reset de formulario) - mas sem
  // brigar com quem esta no meio de digitar.
  const [text, setText] = useState(() => formatDisplay(selected));

  useEffect(() => {
    setText(formatDisplay(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const masked = maskDateInput(event.target.value);

    setText(masked);

    if (masked === '') {
      onChange('');
      return;
    }

    const parsed = parseTypedDate(masked);

    if (parsed) onChange(format(parsed, 'yyyy-MM-dd'));
  };

  /** Saiu do campo com algo incompleto/invalido digitado - volta a refletir o ultimo valor valido. */
  const handleBlur = (): void => {
    if (!parseTypedDate(text) && text !== '') {
      setText(formatDisplay(selected));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-9 w-full min-w-0 rounded-md border border-input bg-background py-1 pr-9 pl-3 text-sm shadow-xs outline-none',
            'placeholder:text-muted-foreground',
            'transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          )}
          {...aria}
        />

        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Abrir calendário"
          >
            <CalendarDays className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
      </div>

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
