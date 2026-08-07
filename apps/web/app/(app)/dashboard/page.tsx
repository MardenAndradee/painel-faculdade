'use client';

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  PartyPopper,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Greeting } from '@/components/dashboard/greeting';
import { StatCard } from '@/components/dashboard/stat-card';
import { AssignmentRow } from '@/components/dashboard/assignment-row';
import { ExamRow } from '@/components/dashboard/exam-row';
import { MiniCalendar } from '@/components/dashboard/mini-calendar';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

/**
 * Dashboard.
 *
 * Consome um unico endpoint agregado: seis chamadas separadas significariam
 * seis idas ao servidor antes da primeira tela aparecer.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={AlertTriangle}
              title="Não foi possível carregar o dashboard"
              description={error instanceof Error ? error.message : 'Tente novamente.'}
              action={
                <Button onClick={() => void refetch()} size="sm">
                  <RefreshCw className="size-4" aria-hidden />
                  Tentar novamente
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, upcomingAssignments, overdueAssignments, upcomingExams, calendar } = data;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      {/* Sem `flex-wrap`: o botao permanece no canto superior direito em
          qualquer largura, em vez de cair sozinho numa linha no celular. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Greeting
            name={user?.name ?? ''}
            semesterName={data.currentSemester?.name ?? null}
            pendingCount={stats.pendingCount}
            overdueCount={stats.overdueCount}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Atualizar dados"
        >
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Estatísticas rápidas */}
      <section aria-label="Estatísticas rápidas" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Em aberto"
          value={stats.pendingCount}
          icon={ListChecks}
          tone={stats.dueTodayCount > 0 ? 'warning' : 'default'}
          hint={
            stats.dueTodayCount > 0
              ? `${stats.dueTodayCount} ${stats.dueTodayCount === 1 ? 'vence' : 'vencem'} hoje`
              : `${stats.dueThisWeekCount} nesta semana`
          }
        />

        <StatCard
          label="Atrasadas"
          value={stats.overdueCount}
          icon={AlertTriangle}
          tone={stats.overdueCount > 0 ? 'danger' : 'success'}
          hint={`${stats.completionRate}% concluído no total`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximas atividades */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden />
              Próximas atividades
            </CardTitle>
            {upcomingAssignments.length > 0 && (
              <Badge variant="secondary">{upcomingAssignments.length}</Badge>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {upcomingAssignments.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nada no horizonte"
                description="Nenhuma atividade com prazo futuro por enquanto."
              />
            ) : (
              <ul className="-mx-2">
                {upcomingAssignments.map((assignment) => (
                  <AssignmentRow key={assignment.id} assignment={assignment} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Próximas provas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
              Próximas provas
            </CardTitle>
            {upcomingExams.length > 0 && <Badge variant="secondary">{upcomingExams.length}</Badge>}
          </CardHeader>

          <CardContent className="pt-0">
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nenhuma prova marcada"
                description="As provas cadastradas aparecerão aqui com a contagem de dias."
              />
            ) : (
              <ul className="-mx-2">
                {upcomingExams.map((exam) => (
                  <ExamRow key={exam.id} exam={exam} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Calendário resumido */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              Calendário
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <MiniCalendar events={calendar} />
          </CardContent>
        </Card>
      </div>

      {/* Atrasadas: só aparece quando existe atraso, para não ocupar espaço à toa. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle
              className={
                overdueAssignments.length > 0
                  ? 'size-4 text-status-overdue'
                  : 'size-4 text-muted-foreground'
              }
              aria-hidden
            />
            Atividades atrasadas
          </CardTitle>
          {overdueAssignments.length > 0 && <Badge variant="overdue">{stats.overdueCount}</Badge>}
        </CardHeader>

        <CardContent className="pt-0">
          {overdueAssignments.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="Nenhuma atividade atrasada"
              description="Todos os prazos em dia. Continue assim."
            />
          ) : (
            <ul className="-mx-2 sm:grid sm:grid-cols-2 sm:gap-x-4">
              {overdueAssignments.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
