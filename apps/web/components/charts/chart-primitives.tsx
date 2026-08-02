'use client';

/**
 * Peças compartilhadas dos gráficos.
 *
 * Concentra as decisões visuais que valem para TODOS eles — grade discreta,
 * eixos finos, tooltip com token de texto — para que não divirjam gráfico a
 * gráfico conforme a tela cresce.
 */

/** Cores lidas dos tokens CSS: mudam com o tema sem recompilar nada. */
export const CHART_COLORS = {
  series1: 'var(--chart-1)',
  series2: 'var(--chart-2)',
  series3: 'var(--chart-3)',
  grid: 'var(--chart-grid)',
  axis: 'var(--muted-foreground)',
} as const;

/** Grade e eixos: fio de cabelo, sólidos, um tom acima da superfície. */
export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: CHART_COLORS.grid,
  strokeWidth: 1,
  vertical: false,
} as const;

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/**
 * Tooltip.
 *
 * O texto usa tokens de tinta, nunca a cor da série: quem carrega a identidade
 * é o quadradinho colorido ao lado, e um rótulo colorido perderia contraste.
 */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{title}</p>

      <div className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            {row.color && (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            )}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Legenda.
 *
 * Presente sempre que houver duas ou mais séries: sem ela a identidade fica
 * codificada só em cor, o que exclui parte dos leitores.
 */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rótulo de data curto para o eixo X ("12/ago"). */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');

  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];

  return `${Number(day)}/${months[Number(month) - 1]}`;
}

/** Minutos em texto curto para eixo e tooltip. */
export function shortMinutes(minutes: number): string {
  if (minutes === 0) return '0';
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours}h` : `${hours}h${rest}`;
}
