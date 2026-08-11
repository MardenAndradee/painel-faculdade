'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatisticsResponse } from '@painel/shared';
import { ChartCard } from './chart-card';
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartLegend,
  ChartTooltip,
  GRID_PROPS,
} from './chart-primitives';
import { formatGrade } from '@/lib/format';

interface SemesterTrendChartProps {
  data: StatisticsResponse['averageBySemester'];
}

const GRADIENT_ID = 'semester-average-fill';

/**
 * Evolucao por semestre.
 *
 * Duas series no MESMO eixo, ambas de 0 a 10 - media simples e CR ponderado
 * medem a mesma coisa em escalas iguais, entao podem dividir o eixo. Se
 * medissem grandezas diferentes, seriam dois graficos: um segundo eixo Y
 * inventaria uma correlacao que os dados nao tem.
 *
 * A media do semestre (serie principal, a que o titulo anuncia) ganha um
 * preenchimento em degrade - um lavado bem fraco da propria cor, nunca um
 * bloco saturado. O CR continua so uma linha por cima: preencher os dois
 * criaria duas areas sobrepostas competindo pela mesma leitura.
 */
export function SemesterTrendChart({ data }: SemesterTrendChartProps) {
  // Só semestres consolidados: um período em andamento ainda não tem média
  // final, e plotá-lo como zero mentiria sobre uma queda.
  const consolidated = data.filter((item) => item.average !== null || item.cr !== null);

  return (
    <ChartCard
      title="Evolução por semestre"
      description="Apenas períodos encerrados, com as médias já consolidadas"
      tableHeaders={['Semestre', 'Média', 'CR']}
      tableRows={consolidated.map((item) => [
        item.label,
        formatGrade(item.average),
        formatGrade(item.cr),
      ])}
      /* Menos de dois pontos nao formam uma tendencia: desenhar um ponto
         solto numa grade de linha sugere uma serie que ainda nao existe. */
      isEmpty={consolidated.length < 2}
      emptyMessage={
        consolidated.length === 0
          ? 'Encerre um semestre no Histórico para ver a evolução.'
          : 'A evolução aparece a partir do segundo semestre encerrado.'
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={consolidated} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.series1} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART_COLORS.series1} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_PROPS} />

          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis domain={[0, 10]} {...AXIS_PROPS} tickCount={6} width={40} />

          <Tooltip
            cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={String(label)}
                  rows={payload
                    .filter((entry) => entry.name !== 'averageFill')
                    .map((entry) => ({
                      label: entry.name === 'average' ? 'Média' : 'CR',
                      value: formatGrade(typeof entry.value === 'number' ? entry.value : null),
                      color: String(entry.color),
                    }))}
                />
              ) : null
            }
          />

          {/* Área só decorativa (o preenchimento sob a média) - a Line abaixo
              é quem de fato desenha o traço e os pontos interativos. */}
          <Area
            type="monotone"
            dataKey="average"
            name="averageFill"
            stroke="none"
            fill={`url(#${GRADIENT_ID})`}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />

          {/* Linhas de 2px e marcadores de 8px: finas o bastante para não
              dominar, grandes o bastante para servir de alvo de hover. */}
          <Line
            type="monotone"
            dataKey="average"
            name="average"
            stroke={CHART_COLORS.series1}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            activeDot={{ r: 5 }}
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="cr"
            name="cr"
            stroke={CHART_COLORS.series2}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ChartLegend
        items={[
          { label: 'Média do semestre', color: CHART_COLORS.series1 },
          { label: 'CR (ponderado por créditos)', color: CHART_COLORS.series2 },
        ]}
      />
    </ChartCard>
  );
}
