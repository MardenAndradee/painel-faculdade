/**
 * Helpers de data no fuso LOCAL.
 *
 * Local, e nao UTC, de proposito: o aluno estuda no fuso dele, e "o que fiz
 * hoje" precisa terminar a meia-noite dele. Usar UTC faria uma revisao das 22h
 * em Sao Paulo cair no dia seguinte.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Meia-noite do dia da data informada. */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  return result;
}

/** Segunda-feira da semana da data informada. */
export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  // getDay(): 0 = domingo. O deslocamento faz a semana comecar na segunda.
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));

  return result;
}

/** Chave "YYYY-MM-DD", usada para agrupar por dia e como rotulo de serie. */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Soma dias preservando a hora. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}
