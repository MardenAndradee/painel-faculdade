'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

/**
 * Minutos estudados por dia.
 *
 * Barra, e nao linha: o dado e um volume por dia, nao uma medida continua. Uma
 * linha ligando dias zerados sugeriria estudo constante onde houve pausa.
 *
 * Serie unica, entao uma cor so e sem legenda - o titulo ja diz o que e.
 */
export function StudyTimeChart({ data }: StudyTimeChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0);

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
          <Bar dataKey="value" fill={CHART_COLORS.series1} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
