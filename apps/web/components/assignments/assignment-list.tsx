'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ListChecks, Plus, RefreshCw, SearchX } from 'lucide-react';
import type { AssignmentListItem } from '@painel/shared';
import { useAssignments, useDeleteAssignment, useToggleComplete } from '@/hooks/use-assignments';
import type { AssignmentListParams } from '@/services/assignment.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { AssignmentItem } from './assignment-item';
import { AssignmentFormDialog } from './assignment-form-dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AssignmentListProps {
  params: AssignmentListParams;
  onPageChange: (page: number) => void;
  /** Pre-seleciona a disciplina ao criar pela tela da disciplina. */
  defaultSubjectId?: string | null;
  /** Diferencia "nenhuma atividade" de "nenhum resultado para o filtro". */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Lista de atividades.
 *
 * Compartilhada entre a tela de Atividades e a aba da disciplina: a diferenca
 * entre elas e apenas o filtro aplicado.
 */
export function AssignmentList({
  params,
  onPageChange,
  defaultSubjectId,
  hasActiveFilters,
  onClearFilters,
}: AssignmentListProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useAssignments(params);
  const toggleComplete = useToggleComplete();
  const deleteAssignment = useDeleteAssignment();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentListItem | null>(null);
  const [deleting, setDeleting] = useState<AssignmentListItem | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const assignments = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
    return (
      <Card>
        <ul>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="mt-0.5 size-5 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-20" />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar as atividades"
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
      {assignments.length === 0 ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma atividade encontrada"
              description="Nenhum resultado para os filtros aplicados."
              action={
                onClearFilters && (
                  <Button variant="outline" size="sm" onClick={onClearFilters}>
                    Limpar filtros
                  </Button>
                )
              }
            />
          ) : params.view === 'concluidas' ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nada concluído ainda"
              description="As atividades marcadas como concluídas aparecerão aqui."
            />
          ) : params.view === 'atrasadas' ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma atividade atrasada"
              description="Todos os prazos em dia. Continue assim."
            />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma atividade por aqui"
              description="Cadastre atividades para acompanhar prazos e prioridades."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" aria-hidden />
                  Nova atividade
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <Card className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ul>
            {assignments.map((assignment) => (
              <AssignmentItem
                key={assignment.id}
                assignment={assignment}
                onToggle={(item) => toggleComplete.mutate(item.id)}
                onEdit={(item) => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        </Card>
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

      <AssignmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assignment={editing}
        defaultSubjectId={defaultSubjectId ?? null}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.title}&quot; será removida permanentemente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteAssignment.mutate(deleting.id);
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
