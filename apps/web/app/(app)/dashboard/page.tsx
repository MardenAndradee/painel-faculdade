'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  PartyPopper,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import { useIsModuleEnabled } from '@/hooks/use-module-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { Greeting } from '@/components/dashboard/greeting';
import { StatCard } from '@/components/ui/stat-card';
import { AssignmentRow } from '@/components/dashboard/assignment-row';
import { ExamRow } from '@/components/dashboard/exam-row';
import { MiniCalendar } from '@/components/dashboard/mini-calendar';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Destaque de hover compartilhado pelos cards da tela: leve elevação + tinta de cor. */
const HOVER_CARD =
  'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40';

/** Colunas conforme quantos cards sobram visíveis - nunca deixa buraco vazio no grid (Etapa 29.10). */
const STATS_GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
};

const MIDDLE_GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
};

/**
 * Dashboard.
 *
 * Consome um unico endpoint agregado: seis chamadas separadas significariam
 * seis idas ao servidor antes da primeira tela aparecer. Cada seção é
 * condicionada ao módulo dono do dado (Atividades/Provas/Calendário) - um
 * módulo desativado nunca deixa buraco vazio, o grid recalcula colunas.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardSummary();
  const showAssignments = useIsModuleEnabled('ASSIGNMENTS');
  const showExams = useIsModuleEnabled('EXAMS');
  const showCalendar = useIsModuleEnabled('CALENDAR');

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
  const nextExam = upcomingExams[0] ?? null;

  const statCount = (showAssignments ? 2 : 0) + (showExams ? 2 : 0);
  const middleCount = (showAssignments ? 1 : 0) + (showExams ? 1 : 0) + (showCalendar ? 1 : 0);
  const nothingToShow = statCount === 0 && middleCount === 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      {/* Sem `flex-wrap`: o botao permanece no canto superior direito em
          qualquer largura, em vez de cair sozinho numa linha no celular. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Greeting
            name={user?.name ?? ''}
            semesterName={data.currentSemester?.name ?? null}
            dueThisWeekCount={stats.dueThisWeekCount}
            nextExamDays={nextExam?.daysUntilExam ?? null}
            showAssignments={showAssignments}
            showExams={showExams}
          />
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      {statCount > 0 && (
        <section
          aria-label="Estatísticas rápidas"
          className={cn('grid gap-4', STATS_GRID_COLS[statCount])}
        >
          {showAssignments && (
            <>
              <StatCard
                label="Em aberto"
                value={stats.pendingCount}
                icon={ListChecks}
                tone={stats.dueTodayCount > 0 ? 'warning' : 'info'}
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
            </>
          )}

          {showExams && (
            <>
              <StatCard
                label="Provas próximas"
                value={stats.upcomingExamCount}
                icon={ClipboardList}
                tone="warning"
                hint={nextExam ? nextExam.subject.name : 'Nenhuma marcada'}
              />

              <StatCard
                label="Próxima prova"
                value={nextExam ? `${nextExam.daysUntilExam}d` : '—'}
                icon={CalendarClock}
                tone={nextExam && nextExam.daysUntilExam <= 3 ? 'warning' : 'violet'}
                hint={nextExam ? formatDate(nextExam.date) : 'Sem provas marcadas'}
              />
            </>
          )}
        </section>
      )}

      {middleCount > 0 && (
        <div className={cn('grid gap-4', MIDDLE_GRID_COLS[middleCount])}>
          {/* Próximas atividades */}
          {showAssignments && (
            <Card className={cn('lg:col-span-1', HOVER_CARD)}>
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
          )}

          {/* Próximas provas */}
          {showExams && (
            <Card className={cn('lg:col-span-1', HOVER_CARD)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
                  Próximas provas
                </CardTitle>
                {upcomingExams.length > 0 && (
                  <Badge variant="secondary">{upcomingExams.length}</Badge>
                )}
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
          )}

          {/* Calendário resumido */}
          {showCalendar && (
            <Card className={cn('lg:col-span-1', HOVER_CARD)}>
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
          )}
        </div>
      )}

      {/* Atrasadas: só aparece quando o módulo está ativo e existe atraso. */}
      {showAssignments && (
        <Card className={HOVER_CARD}>
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
      )}

      {/* Poucos módulos ativos: nada de resumo pra mostrar, só o convite. */}
      {nothingToShow && (
        <Card>
          <EmptyState
            icon={Settings}
            title="Poucos módulos ativos"
            description="Ative mais módulos em Configurações para ver seu resumo aqui."
            action={
              <Button asChild size="sm">
                <Link href="/configuracoes">
                  <Settings className="size-4" aria-hidden />
                  Ir para Configurações
                </Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
