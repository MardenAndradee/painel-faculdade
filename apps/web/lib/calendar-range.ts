import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import type { CalendarView } from '@painel/shared';

/**
 * Intervalos das visoes do calendario.
 *
 * Calculados no fuso do navegador: "semana de 3 a 9 de agosto" depende de onde
 * o usuario esta. O que vai para a API e o instante absoluto (ISO).
 *
 * A visao de mes pede a grade inteira (semanas completas), e nao apenas o mes:
 * as celulas dos dias vizinhos tambem precisam de conteudo.
 */
export function getRange(view: CalendarView, reference: Date): { from: Date; to: Date } {
  switch (view) {
    case 'dia':
      return { from: startOfDay(reference), to: endOfDay(reference) };

    case 'semana':
      return {
        from: startOfWeek(reference, { weekStartsOn: 0 }),
        to: endOfWeek(reference, { weekStartsOn: 0 }),
      };

    case 'mes':
    default:
      return {
        from: startOfWeek(startOfMonth(reference), { weekStartsOn: 0 }),
        to: endOfWeek(endOfMonth(reference), { weekStartsOn: 0 }),
      };
  }
}

/** Avanca ou retrocede um periodo, conforme a visao. */
export function shiftReference(view: CalendarView, reference: Date, direction: 1 | -1): Date {
  if (view === 'dia') return direction === 1 ? addDays(reference, 1) : subDays(reference, 1);
  if (view === 'semana') return direction === 1 ? addWeeks(reference, 1) : subWeeks(reference, 1);

  return direction === 1 ? addMonths(reference, 1) : subMonths(reference, 1);
}
