'use client';

import { format } from 'date-fns';
import { DatePicker } from './date-picker';
import { Input } from './input';

/**
 * Normaliza a entrada para `yyyy-MM-ddTHH:mm`.
 *
 * Os schemas de formulario aceitam `string | Date` no campo (o schema e
 * usado tambem fora de contexto de formulario HTML) - na pratica, vindo de
 * um input, e sempre string, mas o tipo precisa cobrir os dois.
 */
function toDateTimeString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  return format(value, "yyyy-MM-dd'T'HH:mm");
}

/** Separa "yyyy-MM-ddTHH:mm" em data e hora. String vazia quando o campo esta em branco. */
function splitDateTime(value: string): [date: string, time: string] {
  if (!value) return ['', ''];

  const [date, time] = value.split('T');

  return [date ?? '', time ?? ''];
}

function combine(date: string, time: string): string {
  if (!date) return '';

  return `${date}T${time || '00:00'}`;
}

interface DateTimePickerProps {
  /** `yyyy-MM-ddTHH:mm`/`Date`, ou vazio - mesmo contrato do `<input type="datetime-local">` que substitui. */
  value: string | Date | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Data + hora com o calendario proprio para a data e o seletor nativo so para
 * a hora - o popup que incomoda e o de calendario; o de hora do navegador e
 * so um campo com setas, sem overlay estranho, entao fica como esta.
 */
export function DateTimePicker({ value, onChange, id, disabled, ...aria }: DateTimePickerProps) {
  const [datePart, timePart] = splitDateTime(toDateTimeString(value));

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <DatePicker
          id={id}
          value={datePart}
          onChange={(nextDate) => onChange(combine(nextDate, timePart || '00:00'))}
          disabled={disabled}
          {...aria}
        />
      </div>

      <Input
        type="time"
        value={timePart}
        onChange={(event) => onChange(combine(datePart, event.target.value))}
        disabled={disabled || !datePart}
        className="w-[6.5rem] shrink-0"
        aria-label="Horário"
      />
    </div>
  );
}
