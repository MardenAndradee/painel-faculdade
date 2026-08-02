'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react';
import type { AssignmentBreakdown } from '@painel/shared';
import { ChartCard } from './chart-card';

interface AssignmentBreakdownChartProps {
  data: AssignmentBreakdown;
}

/**
 * Situacao das atividades.
 *
 * Barra empilhada horizontal, nao pizza: parte-do-todo com quatro fatias fica
 * ilegivel num circulo, e comparar angulos e pior que comparar comprimentos.
 *
 * As cores aqui sao de STATUS, nao categoricas - elas significam bom, atencao,
 * neutro e critico. Por isso vem dos tokens semanticos do app e nunca da
 * paleta de series, e cada uma vem acompanhada de icone e rotulo: cor sozinha
 * nao pode ser a unica portadora do significado.
 */
const SEGMENTS = [
  {
    key: 'completedOnTime' as const,
    label: 'No prazo',
    color: 'var(--status-completed)',
    icon: CheckCircle2,
  },
  {
    key: 'completedLate' as const,
    label: 'Com atraso',
    color: 'var(--status-pending)',
    icon: Clock,
  },
  { key: 'pending' as const, label: 'Pendentes', color: 'var(--muted-foreground)', icon: Circle },
  {
    key: 'overdue' as const,
    label: 'Vencidas',
    color: 'var(--status-overdue)',
    icon: AlertTriangle,
  },
];

export function AssignmentBreakdownChart({ data }: AssignmentBreakdownChartProps) {
  const total = SEGMENTS.reduce((sum, segment) => sum + data[segment.key], 0);

  return (
    <ChartCard
      title="Situação das atividades"
      description={`${total} ${total === 1 ? 'atividade' : 'atividades'} no total`}
      tableHeaders={['Situação', 'Quantidade', '%']}
      tableRows={SEGMENTS.map((segment) => [
        segment.label,
        String(data[segment.key]),
        total === 0 ? '0%' : `${Math.round((data[segment.key] / total) * 100)}%`,
      ])}
      isEmpty={total === 0}
      emptyMessage="Cadastre atividades para acompanhar sua entrega."
    >
      <div className="space-y-4">
        {/* A barra: `gap-0.5` cria a folga de 2px entre segmentos, que é o que
            os separa — nunca uma borda desenhada em volta de cada um. */}
        <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md">
          {SEGMENTS.map((segment) => {
            const value = data[segment.key];

            if (value === 0) return null;

            return (
              <div
                key={segment.key}
                className="h-full first:rounded-l-md last:rounded-r-md"
                style={{
                  width: `${(value / total) * 100}%`,
                  backgroundColor: segment.color,
                }}
                role="img"
                aria-label={`${segment.label}: ${value} de ${total}`}
              />
            );
          })}
        </div>

        {/* Legenda com ícone + rótulo + número: o valor exato fica legível sem
            hover, e o significado não depende só da cor. */}
        <ul className="grid gap-2 sm:grid-cols-2">
          {SEGMENTS.map((segment) => {
            const value = data[segment.key];
            const Icon = segment.icon;

            return (
              <li key={segment.key} className="flex min-w-0 items-center gap-2">
                <Icon className="size-3.5 shrink-0" style={{ color: segment.color }} aria-hidden />

                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {segment.label}
                </span>

                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {value}
                  {total > 0 && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      {Math.round((value / total) * 100)}%
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
