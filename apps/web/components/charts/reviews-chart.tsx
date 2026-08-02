'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimePoint } from '@painel/shared';
import { ChartCard } from './chart-card';
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, GRID_PROPS, shortDate } from './chart-primitives';

interface ReviewsChartProps {
  data: TimePoint[];
}

/**
 * Revisoes de flashcards por dia.
 *
 * Grafico proprio, e nao uma segunda serie no grafico de tempo de estudo:
 * minutos e contagem de cartoes tem escalas incomparaveis, e coloca-los no
 * mesmo plot exigiria dois eixos Y - o que inventaria uma correlacao inexistente
 * a partir do alinhamento arbitrario das duas escalas.
 */
export function ReviewsChart({ data }: ReviewsChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const tickInterval = Math.max(0, Math.floor(data.length / 8) - 1);

  return (
    <ChartCard
      title="Revisões de flashcards"
      description={`${total} ${total === 1 ? 'revisão' : 'revisões'} no período`}
      tableHeaders={['Dia', 'Revisões']}
      tableRows={data.filter((p) => p.value > 0).map((p) => [shortDate(p.date), String(p.value)])}
      isEmpty={total === 0}
      emptyMessage="Estude flashcards para acompanhar seu ritmo de revisão."
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="reviews-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.series3} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.series3} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_PROPS} />

          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            interval={tickInterval}
            tickFormatter={shortDate}
            minTickGap={8}
          />

          <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />

          <Tooltip
            cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={shortDate(String(label))}
                  rows={[
                    {
                      label: 'Revisões',
                      value: String(payload[0]?.value ?? 0),
                      color: CHART_COLORS.series3,
                    },
                  ]}
                />
              ) : null
            }
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.series3}
            strokeWidth={2}
            fill="url(#reviews-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
