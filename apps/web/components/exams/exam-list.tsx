'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Plus,
  RefreshCw,
  SearchX,
} from 'lucide-react';
import type { ExamListItem } from '@painel/shared';
import { useDeleteExam, useExams } from '@/hooks/use-exams';
import type { ExamListParams } from '@/services/exam.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ExamItem } from './exam-item';
import { ExamFormDialog } from './exam-form-dialog';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExamListProps {
  params: ExamListParams;
  onPageChange: (page: number) => void;
  defaultSubjectId?: string | null;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

/** Lista de provas, compartilhada entre a tela de Provas e a aba da disciplina. */
export function ExamList({
  params,
  onPageChange,
  defaultSubjectId,
  hasActiveFilters,
  onClearFilters,
}: ExamListProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useExams(params);
  const deleteExam = useDeleteExam();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExamListItem | null>(null);
  const [deleting, setDeleting] = useState<ExamListItem | null>(null);

  const exams = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="size-[72px] shrink-0 rounded-2xl" />
            </div>
            <div className="mt-4 flex gap-5 border-t pt-3.5">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar as provas"
          description={error instanceof Error ? error.message : 'Tente novamente.'}
          action={
            <Button size="sm" onClick={() => void refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              Tentar novamente
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      {exams.length === 0 ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma prova encontrada"
              description="Nenhum resultado para os filtros aplicados."
              action={
                onClearFilters && (
                  <Button variant="outline" size="sm" onClick={onClearFilters}>
                    Limpar filtros
                  </Button>
                )
              }
            />
          ) : params.view === 'realizadas' ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhuma prova realizada"
              description="As provas que já aconteceram aparecerão aqui, com a nota quando lançada."
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma prova marcada"
              description="Cadastre suas provas para acompanhar a contagem regressiva e o conteúdo."
              action={
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Nova prova
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <ul
          className={cn('grid gap-4 transition-opacity sm:grid-cols-2', isFetching && 'opacity-60')}
        >
          {exams.map((exam) => (
            <ExamItem
              key={exam.id}
              exam={exam}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} no total
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => onPageChange(meta.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ExamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        exam={editing}
        defaultSubjectId={defaultSubjectId ?? null}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prova?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.title}&quot; de {deleting?.subject.name} será removida
              permanentemente.
              {deleting?.grade && ' A nota vinculada será desvinculada, mas não excluída.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteExam.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
