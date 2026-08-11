'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { TimePoint } from '@painel/shared';
import { ChartCard } from './chart-card';
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartTooltip,
  GRID_PROPS,
  shortDate,
  shortMinutes,
} from './chart-primitives';

interface StudyTimeChartProps {
  data: TimePoint[];
}

/** Quantas barras mais recentes recebem a cor cheia, em vez do tom apagado. */
const HIGHLIGHT_DAYS = 7;

/**
 * Variação da última semana cheia contra a anterior.
 *
 * Precisa de duas semanas completas nos dados para significar algo - com
 * menos, a comparação seria entre janelas de tamanhos diferentes.
 */
function computeTrend(data: TimePoint[]): number | null {
  if (data.length < HIGHLIGHT_DAYS * 2) return null;

  const recent = data.slice(-HIGHLIGHT_DAYS).reduce((sum, point) => sum + point.value, 0);
  const previous = data
    .slice(-HIGHLIGHT_DAYS * 2, -HIGHLIGHT_DAYS)
    .reduce((sum, point) => sum + point.value, 0);

  if (previous === 0) return recent > 0 ? 100 : null;

  return Math.round(((recent - previous) / previous) * 100);
}

/**
 * Minutos estudados por dia.
 *
 * Barra, e nao linha: o dado e um volume por dia, nao uma medida continua. Uma
 * linha ligando dias zerados sugeriria estudo constante onde houve pausa.
 *
 * Serie unica, entao uma cor so e sem legenda - o titulo ja diz o que e. As
 * barras da última semana ficam na cor cheia, as anteriores em tom apagado -
 * mesmo canal (opacidade), não uma segunda cor, então não é uma identidade
 * nova a validar.
 */
export function StudyTimeChart({ data }: StudyTimeChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const trend = computeTrend(data);

  // Com muitos dias, rotular todos vira borrão: mostramos ~8 marcas.
  const tickInterval = Math.max(0, Math.floor(data.length / 8) - 1);

  return (
    <ChartCard
      title="Tempo de estudo por dia"
      description={`${shortMinutes(total)} no período · tempo real registrado`}
      tableHeaders={['Dia', 'Minutos']}
      tableRows={data.filter((p) => p.value > 0).map((p) => [shortDate(p.date), String(p.value)])}
      isEmpty={total === 0}
      emptyMessage="Conclua blocos do cronograma para registrar tempo de estudo."
      badge={
        trend === null ? undefined : (
          <span
            className={
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
              (trend >= 0
                ? 'bg-status-completed/15 text-status-completed'
                : 'bg-status-overdue/15 text-status-overdue')
            }
          >
            {trend >= 0 ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
        )
      }
    >
      {/* Altura fixa inclui a faixa do eixo X: sem isso o card ganha um
          scroll vertical minúsculo só para os rótulos. */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />

          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            interval={tickInterval}
            tickFormatter={shortDate}
            minTickGap={8}
          />

          {/* `width` folgado o bastante para "1h30" caber inteiro: com menos,
              o rotulo era cortado e virava "h30". */}
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(value: number) => shortMinutes(value)}
            width={52}
          />

          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={shortDate(String(label))}
                  rows={[
                    {
                      label: 'Estudado',
                      value: shortMinutes(Number(payload[0]?.value ?? 0)),
                      color: CHART_COLORS.series1,
                    },
                  ]}
                />
              ) : null
            }
          />

          {/* Cantos superiores arredondados em 4px, ancorados na linha de base. */}
          <Bar dataKey="value" fill={CHART_COLORS.series1} radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((point, index) => (
              <Cell
                key={point.date}
                fillOpacity={index >= data.length - HIGHLIGHT_DAYS ? 1 : 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
