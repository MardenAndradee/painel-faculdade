'use client';

import { useState } from 'react';
import { AlertTriangle, BookOpen, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import type { GradeListItem } from '@painel/shared';
import { useGradesOverview } from '@/hooks/use-grades';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { SubjectGradesCard } from '@/components/grades/subject-grades-card';
import { GradeFormDialog } from '@/components/grades/grade-form-dialog';
import { formatGrade } from '@/lib/format';

/** Boletim de todas as disciplinas em andamento. */
export default function GradesPage() {
  const { data, isLoading, isError, error, refetch } = useGradesOverview();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GradeListItem | null>(null);
  const [defaultSubjectId, setDefaultSubjectId] = useState<string | null>(null);

  const openCreate = (subjectId?: string): void => {
    setEditing(null);
    setDefaultSubjectId(subjectId ?? null);
    setFormOpen(true);
  };

  const openEdit = (grade: GradeListItem): void => {
    setEditing(grade);
    setDefaultSubjectId(null);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe suas médias e o que falta para a aprovação.
          </p>
        </div>

        <Button onClick={() => openCreate()} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Lançar nota</span>
          <span className="sm:hidden">Lançar</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Média geral</p>
                <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatGrade(data.overallAverage)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.overallAverage === null
                  ? 'Nenhuma nota lançada'
                  : 'Média das disciplinas com nota'}
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Notas lançadas</p>
                <BookOpen className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data.totalGrades}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                em {data.subjects.length}{' '}
                {data.subjects.length === 1 ? 'disciplina' : 'disciplinas'}
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Precisam de atenção</p>
                <AlertTriangle
                  className={
                    data.subjectsAtRisk > 0
                      ? 'size-4 text-status-overdue'
                      : 'size-4 text-muted-foreground'
                  }
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data.subjectsAtRisk}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.subjectsAtRisk === 0 ? 'Tudo sob controle' : 'com risco de reprovação'}
              </p>
            </Card>
          </div>

          {/* Boletim por disciplina */}
          <div className="space-y-4">
            {data.subjects.map((summary) => (
              <SubjectGradesCard
                key={summary.subject.id}
                summary={summary}
                onAddGrade={openCreate}
                onEditGrade={openEdit}
              />
            ))}
          </div>
        </>
      )}

      <GradeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        grade={editing}
        defaultSubjectId={defaultSubjectId}
      />
    </div>
  );
}
