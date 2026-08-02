'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  ChartColumn,
  Clock,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  STATS_PERIODS,
  STATS_PERIOD_LABELS,
  type StatsPeriod,
  type StatisticsHighlights,
} from '@painel/shared';
import { useStatistics } from '@/hooks/use-statistics';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StudyTimeChart } from '@/components/charts/study-time-chart';
import { SubjectAverageChart } from '@/components/charts/subject-average-chart';
import { SemesterTrendChart } from '@/components/charts/semester-trend-chart';
import { AssignmentBreakdownChart } from '@/components/charts/assignment-breakdown-chart';
import { ReviewsChart } from '@/components/charts/reviews-chart';
import { shortMinutes } from '@/components/charts/chart-primitives';
import { formatGrade } from '@/lib/format';

/**
 * Numero de destaque.
 *
 * Um valor unico e um *stat tile*, nao um grafico de uma barra. Sem
 * `tabular-nums` no numero grande: digitos de largura igual deixam "121"
 * frouxo em corpo de exibicao.
 */
function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Award;
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Highlights({ highlights }: { highlights: StatisticsHighlights }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Média atual"
        value={formatGrade(highlights.currentAverage)}
        hint={
          highlights.overallCr === null
            ? 'disciplinas em andamento'
            : `CR consolidado ${formatGrade(highlights.overallCr)}`
        }
        icon={Award}
      />

      <StatTile
        label="Tempo estudado"
        value={shortMinutes(highlights.studiedMinutes)}
        hint={`${highlights.streakDays} ${highlights.streakDays === 1 ? 'dia seguido' : 'dias seguidos'}`}
        icon={Clock}
      />

      <StatTile
        label="Atividades entregues"
        value={String(highlights.completedAssignments)}
        hint={
          highlights.onTimeRate === null
            ? 'nenhuma entrega no período'
            : `${highlights.onTimeRate}% no prazo`
        }
        icon={CalendarCheck}
      />

      <StatTile
        label="Cartões dominados"
        value={String(highlights.masteredCards)}
        hint={`${highlights.flashcardReviews} revisões no período`}
        icon={Layers}
      />
    </div>
  );
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('90');

  const { data, isLoading, isError, error, refetch, isFetching } = useStatistics(period);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Estatísticas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Como seu semestre está indo, em números.
          </p>
        </div>

        {/*
          Um único filtro, acima de tudo que ele afeta.
          Filtros dentro de cada card fariam o usuário comparar recortes
          diferentes sem perceber.
        */}
        <Select value={period} onValueChange={(value) => setPeriod(value as StatsPeriod)}>
          <SelectTrigger className="w-full shrink-0 sm:w-52" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATS_PERIODS.map((item) => (
              <SelectItem key={item} value={item}>
                {STATS_PERIOD_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      ) : isError || !data ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as estatísticas"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : (
        /*
          Durante uma nova busca, o conteúdo anterior fica com opacidade
          reduzida em vez de virar esqueleto: trocar o período não pode fazer
          a página saltar.
        */
        <div
          className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          aria-busy={isFetching}
        >
          <Highlights highlights={data.highlights} />

          <div className="grid gap-4 lg:grid-cols-2">
            <StudyTimeChart data={data.studyMinutesByDay} />
            <SubjectAverageChart data={data.averageBySubject} />
            <SemesterTrendChart data={data.averageBySemester} />
            <AssignmentBreakdownChart data={data.assignmentBreakdown} />
            <ReviewsChart data={data.reviewsByDay} />

            <StudyTimeBySubject data={data.studyMinutesBySubject} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tempo por disciplina.
 *
 * Lista com barras proporcionais em vez de um gráfico Recharts: são poucas
 * linhas, e a lista já entrega comparação de magnitude com o número exato
 * ao lado — um gráfico aqui seria enfeite.
 */
function StudyTimeBySubject({
  data,
}: {
  data: { id: string; label: string; value: number; color?: string }[];
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">Tempo por disciplina</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {total === 0 ? 'Sem tempo registrado' : `${shortMinutes(total)} distribuídos`}
        </p>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="Nada para mostrar"
          description="Vincule blocos do cronograma a disciplinas para ver a distribuição."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">{item.label}</span>
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {shortMinutes(item.value)}
                </span>
              </div>

              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color ?? 'var(--muted-foreground)',
                  }}
                  role="img"
                  aria-label={`${item.label}: ${shortMinutes(item.value)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
