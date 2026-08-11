'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryValue } from '@painel/shared';
import { ChartCard } from './chart-card';
import { ChartTooltip, shortMinutes } from './chart-primitives';

interface StudyTimeDonutChartProps {
  data: CategoryValue[];
}

const FALLBACK_COLOR = 'var(--muted-foreground)';

function percentOf(value: number, total: number): string {
  return total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`;
}

/**
 * Tempo por disciplina, em rosca.
 *
 * Comparar ângulos é pior que comparar comprimentos - uma barra horizontal
 * seria a escolha "mais correta" para parte-do-todo. Rosca aqui por pedido
 * explícito de espelhar o mockup; a % direta na legenda ao lado (e a tabela
 * equivalente do `ChartCard`) cobre o que o ângulo sozinho não deixaria ler.
 *
 * Cor de cada fatia é a cor REAL da disciplina (a mesma usada em todo o
 * resto do app) - identidade do dado, não uma paleta categórica nova a
 * validar.
 */
export function StudyTimeDonutChart({ data }: StudyTimeDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard
      title="Distribuição do tempo"
      description={
        total === 0 ? 'Sem tempo registrado' : `${shortMinutes(total)} distribuídos, por disciplina`
      }
      tableHeaders={['Disciplina', 'Tempo', '%']}
      tableRows={data.map((item) => [
        item.label,
        shortMinutes(item.value),
        percentOf(item.value, total),
      ])}
      isEmpty={data.length === 0}
      emptyMessage="Vincule blocos do cronograma a disciplinas para ver a distribuição."
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <ResponsiveContainer width={168} height={168} className="shrink-0">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={data.length > 1 ? 3 : 0}
              // Anel na cor da superfície: é o que separa as fatias, nunca uma
              // borda em volta de cada uma.
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((item) => (
                <Cell key={item.id} fill={item.color ?? FALLBACK_COLOR} />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={String(payload[0]?.name ?? '')}
                    rows={[
                      {
                        label: 'Tempo',
                        value: shortMinutes(Number(payload[0]?.value ?? 0)),
                        color: String(
                          (payload[0]?.payload as { color?: string } | undefined)?.color ??
                            FALLBACK_COLOR,
                        ),
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>

        <ul className="w-full min-w-0 space-y-2.5">
          {data.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color ?? FALLBACK_COLOR }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {percentOf(item.value, total)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
