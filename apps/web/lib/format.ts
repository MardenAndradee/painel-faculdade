import { format, formatDistanceToNowStrict, isThisYear, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formatacao de datas e prazos em portugues.
 *
 * Centralizada para que "vence hoje" tenha exatamente a mesma redacao no
 * dashboard, na lista de atividades e no calendario.
 */

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return format(date, isThisYear(date) ? "d 'de' MMM" : "d 'de' MMM 'de' yyyy", { locale: ptBR });
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return format(date, 'HH:mm', { locale: ptBR });
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

export function formatWeekday(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return format(date, 'EEEE', { locale: ptBR });
}

/**
 * Prazo em linguagem natural.
 *
 * Recebe os dias ja calculados pela API para que o texto acompanhe o mesmo
 * criterio de "dia de calendario" usado no servidor - recalcular no cliente
 * poderia divergir por fuso ou por horas restantes.
 */
export function formatDueLabel(days: number | null): string {
  if (days === null) return 'Sem prazo';

  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  if (days === -1) return 'Venceu ontem';

  if (days < 0) return `Atrasada há ${Math.abs(days)} dias`;

  if (days <= 7) return `Vence em ${days} dias`;

  return `Vence em ${days} dias`;
}

export function formatExamLabel(days: number): string {
  if (days === 0) return 'É hoje';
  if (days === 1) return 'É amanhã';

  return `Em ${days} dias`;
}

/** Rotulo relativo curto ("há 3 dias"), usado em historicos. */
export function formatRelative(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';

  return formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true });
}

/** Nota formatada com uma casa decimal, ou travessao quando ausente. */
export function formatGrade(value: number | null): string {
  if (value === null) return '—';

  return value.toFixed(1).replace('.', ',');
}

/**
 * Tamanho de arquivo legivel.
 *
 * Usa base 1024 com os rotulos curtos (KB, MB) que o usuario ja conhece de
 * gerenciadores de arquivo. Links nao tem tamanho e recebem travessao.
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  // Bytes inteiros nao ganham casa decimal; a partir de KB, uma casa basta.
  const formatted = exponent === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',');

  return `${formatted} ${units[exponent]}`;
}

/**
 * Sigla curta para o chip de uma disciplina.
 *
 * Usa o codigo real quando existe (mais reconhecivel - "MA203"); sem codigo,
 * deriva das iniciais do nome. Compartilhada entre os cards de disciplina,
 * de nota e do historico para nao divergir a mesma regra em 3 lugares.
 */
export function subjectInitials(name: string, code?: string | null): string {
  if (code) return code.slice(0, 3).toUpperCase();

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) return (words[0] ?? '').slice(0, 3).toUpperCase();

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}
