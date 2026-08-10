'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Plus, RefreshCw } from 'lucide-react';
import type { GradeListItem } from '@painel/shared';
import { useGradesOverview } from '@/hooks/use-grades';
import { useHistory, useSemesters } from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { GradeProgressRing } from '@/components/grades/grade-progress-ring';
import { SubjectGradeSummaryCard } from '@/components/grades/subject-grade-summary-card';
import { GradeFormDialog } from '@/components/grades/grade-form-dialog';
import { GradeQuickEntryDialog } from '@/components/grades/grade-quick-entry-dialog';
import { GradeConfigurationDialog } from '@/components/grades/grade-configuration-dialog';
import { GradeSimulationDialog } from '@/components/grades/grade-simulation-dialog';
import { formatGrade } from '@/lib/format';
import { cn } from '@/lib/utils';

const ALL = '__all__';

/** Boletim de todas as disciplinas em andamento. */
export default function GradesPage() {
  const { data: semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState<string>(ALL);
  const effectiveSemesterId = semesterId === ALL ? undefined : semesterId;

  const { data, isLoading, isError, error, refetch } = useGradesOverview(effectiveSemesterId);
  const { data: history } = useHistory();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GradeListItem | null>(null);
  const [configuringSubjectId, setConfiguringSubjectId] = useState<string | null>(null);
  const [simulatingSubjectId, setSimulatingSubjectId] = useState<string | null>(null);
  const [quickEntrySubjectId, setQuickEntrySubjectId] = useState<string | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (grade: GradeListItem): void => {
    setEditing(grade);
    setFormOpen(true);
  };

  const configuringSubject = useMemo(
    () => data?.subjects.find((summary) => summary.subject.id === configuringSubjectId)?.subject,
    [data, configuringSubjectId],
  );

  const simulatingSubject = useMemo(
    () => data?.subjects.find((summary) => summary.subject.id === simulatingSubjectId)?.subject,
    [data, simulatingSubjectId],
  );

  const quickEntrySubject = useMemo(
    () => data?.subjects.find((summary) => summary.subject.id === quickEntrySubjectId)?.subject,
    [data, quickEntrySubjectId],
  );

  const approvedCount = data?.subjects.filter((item) => item.status === 'APROVADO').length ?? 0;
  const totalSubjects = data?.subjects.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.overallAverage !== undefined && data.overallAverage !== null
              ? `Média geral ${formatGrade(data.overallAverage)} · ${data.subjectsAtRisk === 0 ? 'nenhuma disciplina em recuperação' : `${data.subjectsAtRisk} em recuperação`}`
              : 'Acompanhe suas médias e o que falta para a aprovação.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {semesters && semesters.length > 0 && (
            <div className="flex rounded-lg border bg-card p-0.5">
              {semesters.slice(0, 3).map((semester) => (
                <button
                  key={semester.id}
                  type="button"
                  onClick={() => setSemesterId(semester.id)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm transition-colors',
                    semesterId === semester.id
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {semester.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSemesterId(ALL)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm transition-colors',
                  semesterId === ALL
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Tudo
              </button>
            </div>
          )}

          <Button variant="accent" onClick={() => openCreate()} className="shrink-0">
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Lançar nota</span>
            <span className="sm:hidden">Lançar</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as notas"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : data.subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nenhuma disciplina em andamento"
            description="Cadastre disciplinas para começar a lançar notas."
          />
        </Card>
      ) : (
        <>
          {/* Resumo geral */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-4 rounded-2xl border bg-card px-[18px] py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
              <GradeProgressRing
                progress={(data.overallAverage ?? 0) / 10}
                color="var(--primary)"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums">
                  {formatGrade(data.overallAverage)}
                </p>
                <p className="text-xs text-muted-foreground">Média geral</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {totalSubjects} {totalSubjects === 1 ? 'disciplina' : 'disciplinas'} em curso
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border bg-card px-[18px] py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
              <GradeProgressRing progress={(history?.overallCr ?? 0) / 10} color="#2dd4bf" />
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums">
                  {formatGrade(history?.overallCr ?? null)}
                </p>
                <p className="text-xs text-muted-foreground">CR acumulado</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {history?.approvedSubjects ?? 0} disciplinas aprovadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border bg-card px-[18px] py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
              <GradeProgressRing
                progress={totalSubjects > 0 ? approvedCount / totalSubjects : 0}
                color="var(--status-completed)"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Aprovadas por média</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {data.subjectsAtRisk === 0 ? 'nenhuma em recuperação' : 'algumas em recuperação'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border bg-card px-[18px] py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
              <GradeProgressRing
                progress={totalSubjects > 0 ? data.subjectsAtRisk / totalSubjects : 0}
                color="var(--status-pending)"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums">{data.subjectsAtRisk}</p>
                <p className="text-xs text-muted-foreground">Atenção</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {data.subjectsAtRisk === 0 ? 'tudo sob controle' : 'risco de reprovação'}
                </p>
              </div>
            </div>
          </div>

          {/* Boletim por disciplina */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.subjects.map((summary) => (
              <SubjectGradeSummaryCard
                key={summary.subject.id}
                summary={summary}
                onAddGrade={setQuickEntrySubjectId}
                onEditGrade={openEdit}
                onConfigure={setConfiguringSubjectId}
                onSimulate={setSimulatingSubjectId}
              />
            ))}
          </div>
        </>
      )}

      <GradeFormDialog open={formOpen} onOpenChange={setFormOpen} grade={editing} />

      {configuringSubject && (
        <GradeConfigurationDialog
          open={Boolean(configuringSubjectId)}
          onOpenChange={(open) => !open && setConfiguringSubjectId(null)}
          subjectId={configuringSubject.id}
          subjectName={configuringSubject.name}
        />
      )}

      {simulatingSubject && (
        <GradeSimulationDialog
          open={Boolean(simulatingSubjectId)}
          onOpenChange={(open) => !open && setSimulatingSubjectId(null)}
          subjectId={simulatingSubject.id}
          subjectName={simulatingSubject.name}
        />
      )}

      {quickEntrySubject && (
        <GradeQuickEntryDialog
          open={Boolean(quickEntrySubjectId)}
          onOpenChange={(open) => !open && setQuickEntrySubjectId(null)}
          subjectId={quickEntrySubject.id}
          subjectName={quickEntrySubject.name}
        />
      )}
    </div>
  );
}
