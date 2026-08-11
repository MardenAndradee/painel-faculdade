'use client';

import type { GoalProgress, StatisticsGoals } from '@painel/shared';
import { GradeProgressRing } from '@/components/grades/grade-progress-ring';
import { ChartCard } from './chart-card';
import { CHART_COLORS, shortMinutes } from './chart-primitives';

interface SemesterGoalsCardProps {
  goals: StatisticsGoals;
}

function GoalRing({
  label,
  progress,
  color,
  caption,
}: {
  label: string;
  progress: GoalProgress | null;
  color: string;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className="relative flex size-20 shrink-0 items-center justify-center">
        <GradeProgressRing
          progress={(progress?.percent ?? 0) / 100}
          color={progress ? color : 'var(--muted-foreground)'}
          size={80}
          strokeWidth={6}
        />
        <span className="absolute text-base font-semibold tabular-nums">
          {progress ? `${progress.percent}%` : '—'}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

/**
 * Metas do período: três anéis, três metas derivadas de dado real - nunca um
 * número inventado.
 *
 * - Atividades: entregues vs total (a mesma conta da barra de "Situação das
 *   atividades", só que como uma fração só).
 * - Horas de estudo: minutos estudados vs a disponibilidade que o próprio
 *   usuário declarou no Cronograma. Sem disponibilidade declarada não há meta
 *   - mostrar 0% seria fingir uma meta que não existe.
 * - Frequência: dias com alguma atividade de estudo vs dias do período.
 *
 * Cores: as três do `--chart-1/2/3`, já validadas para daltonismo - o mesmo
 * trio usado nos outros gráficos da tela, sem inventar uma paleta nova para
 * três fatias.
 */
export function SemesterGoalsCard({ goals }: SemesterGoalsCardProps) {
  const assignmentsCaption =
    goals.assignments.target === 0
      ? 'nenhuma no período'
      : `${goals.assignments.actual} de ${goals.assignments.target} entregues`;

  const studyCaption = goals.studyMinutes
    ? `${shortMinutes(goals.studyMinutes.actual)} de ${shortMinutes(goals.studyMinutes.target)}`
    : 'sem meta declarada';

  const frequencyCaption = `${goals.frequency.actual} de ${goals.frequency.target} dias`;

  return (
    <ChartCard
      title="Metas do período"
      description="Progresso acumulado"
      tableHeaders={['Meta', 'Progresso', '%']}
      tableRows={[
        ['Atividades', assignmentsCaption, `${goals.assignments.percent}%`],
        [
          'Horas de estudo',
          studyCaption,
          goals.studyMinutes ? `${goals.studyMinutes.percent}%` : '—',
        ],
        ['Frequência', frequencyCaption, `${goals.frequency.percent}%`],
      ]}
    >
      <div className="grid grid-cols-3 gap-2 py-2">
        <GoalRing
          label="Atividades"
          progress={goals.assignments}
          color={CHART_COLORS.series1}
          caption={assignmentsCaption}
        />
        <GoalRing
          label="Horas de estudo"
          progress={goals.studyMinutes}
          color={CHART_COLORS.series2}
          caption={studyCaption}
        />
        <GoalRing
          label="Frequência"
          progress={goals.frequency}
          color={CHART_COLORS.series3}
          caption={frequencyCaption}
        />
      </div>
    </ChartCard>
  );
}
