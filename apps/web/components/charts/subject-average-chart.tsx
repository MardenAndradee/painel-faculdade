'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryValue } from '@painel/shared';
import { ChartCard } from './chart-card';
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, GRID_PROPS } from './chart-primitives';
import { formatGrade } from '@/lib/format';

interface SubjectAverageChartProps {
  data: CategoryValue[];
  /** Nota de corte, desenhada como referência. */
  passingGrade?: number;
}

/**
 * Média por disciplina.
 *
 * Barras HORIZONTAIS porque os nomes de disciplina sao longos - na vertical
 * eles girariam ou seriam cortados.
 *
 * Uma cor so para todas as barras, apesar de cada disciplina ter a sua no
 * resto do app: aqui o comprimento da barra JA codifica o valor, e pintar
 * cada uma de um tom gastaria o unico canal livre repetindo informacao que o
 * grafico ja mostra. A identidade fica no rotulo do eixo.
 */
export function SubjectAverageChart({ data, passingGrade = 6 }: SubjectAverageChartProps) {
  return (
    <ChartCard
      title="Média por disciplina"
      description="Calculada com as notas lançadas, ponderada pelos pesos"
      tableHeaders={['Disciplina', 'Média']}
      tableRows={data.map((item) => [item.label, formatGrade(item.value)])}
      isEmpty={data.length === 0}
      emptyMessage="Lance notas para acompanhar a média de cada disciplina."
    >
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42 + 30)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 0, left: 4 }}
          barCategoryGap={8}
        >
          <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />

          <XAxis type="number" domain={[0, 10]} {...AXIS_PROPS} tickCount={6} />

          <YAxis
            type="category"
            dataKey="label"
            {...AXIS_PROPS}
            width={130}
            tickFormatter={(value: string) =>
              value.length > 18 ? `${value.slice(0, 17)}…` : value
            }
          />

          {/* Linha de aprovação: dá sentido ao comprimento da barra. */}
          <ReferenceLine
            x={passingGrade}
            stroke={CHART_COLORS.axis}
            strokeWidth={1}
            label={{
              value: `corte ${formatGrade(passingGrade)}`,
              position: 'top',
              fill: CHART_COLORS.axis,
              fontSize: 10,
            }}
          />

          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={String(payload[0]?.payload?.label ?? '')}
                  rows={[
                    {
                      label: 'Média',
                      value: formatGrade(Number(payload[0]?.value ?? 0)),
                      color: CHART_COLORS.series1,
                    },
                  ]}
                />
              ) : null
            }
          />

          <Bar dataKey="value" fill={CHART_COLORS.series1} radius={[0, 4, 4, 0]} maxBarSize={24}>
            {/* Rótulo direto na ponta: o número exato fica legível sem hover,
                o que também cumpre a exigência de alívio para o contraste. */}
            <LabelList
              dataKey="value"
              position="right"
              className="fill-foreground"
              fontSize={11}
              formatter={(value: unknown) => (typeof value === 'number' ? formatGrade(value) : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
