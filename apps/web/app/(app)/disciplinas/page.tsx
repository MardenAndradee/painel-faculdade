'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, GraduationCap, Plus, RefreshCw, SearchX } from 'lucide-react';
import type { SubjectListItem } from '@painel/shared';
import { useArchiveSubject, useRestoreSubject, useSubjects } from '@/hooks/use-subjects';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { SubjectCard } from '@/components/subjects/subject-card';
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog';
import { DeleteSubjectDialog } from '@/components/subjects/delete-subject-dialog';
import {
  SubjectFilters,
  ALL_STATUS,
  type SubjectFiltersState,
} from '@/components/subjects/subject-filters';

/** Listagem de disciplinas com busca, filtros, ordenacao e paginacao. */
export default function SubjectsPage() {
  const [filters, setFilters] = useState<SubjectFiltersState>({
    search: '',
    status: ALL_STATUS,
    sortBy: 'name',
    order: 'asc',
    includeArchived: false,
  });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectListItem | null>(null);
  const [deleting, setDeleting] = useState<SubjectListItem | null>(null);

  // A busca só vai à API depois que o usuário para de digitar.
  const debouncedSearch = useDebouncedValue(filters.search);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: filters.status === ALL_STATUS ? undefined : filters.status,
      includeArchived: filters.includeArchived,
      sortBy: filters.sortBy,
      order: filters.order,
      page,
      perPage: 12,
    }),
    [debouncedSearch, filters.status, filters.includeArchived, filters.sortBy, filters.order, page],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSubjects(params);
  const archiveSubject = useArchiveSubject();
  const restoreSubject = useRestoreSubject();

  const handleFiltersChange = (next: SubjectFiltersState): void => {
    setFilters(next);
    // Trocar de filtro reinicia a paginação: continuar na página 4 de um
    // resultado que agora tem uma página só mostraria tela vazia.
    setPage(1);
  };

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (subject: SubjectListItem): void => {
    setEditing(subject);
    setFormOpen(true);
  };

  const subjects = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = debouncedSearch !== '' || filters.status !== ALL_STATUS;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Disciplinas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta
              ? `${meta.total} ${meta.total === 1 ? 'disciplina' : 'disciplinas'}`
              : 'Carregando...'}
          </p>
        </div>

        <Button variant="accent" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nova disciplina</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      <SubjectFilters value={filters} onChange={handleFiltersChange} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <div className="mt-6 flex items-end justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-10" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as disciplinas"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : subjects.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma disciplina encontrada"
              description="Nenhum resultado para os filtros aplicados. Tente ajustar a busca."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleFiltersChange({
                      search: '',
                      status: ALL_STATUS,
                      sortBy: 'name',
                      order: 'asc',
                      includeArchived: false,
                    })
                  }
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="Nenhuma disciplina cadastrada"
              description="Cadastre suas matérias para acompanhar atividades, provas e notas em um só lugar."
              action={
                <Button variant="accent" size="sm" onClick={openCreate}>
                  <Plus className="size-4" aria-hidden />
                  Cadastrar disciplina
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          {/* `isFetching` sem `isLoading` = troca de página/filtro em curso. */}
          <div
            className={
              isFetching
                ? 'grid gap-4 opacity-60 transition-opacity sm:grid-cols-2 xl:grid-cols-3'
                : 'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3'
            }
          >
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onEdit={openEdit}
                onArchive={(item) => void archiveSubject.mutateAsync(item.id)}
                onRestore={(item) => void restoreSubject.mutateAsync(item.id)}
                onDelete={setDeleting}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Página {meta.page} de {meta.totalPages}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <SubjectFormDialog open={formOpen} onOpenChange={setFormOpen} subject={editing} />

      <DeleteSubjectDialog subject={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </div>
  );
}
