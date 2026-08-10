'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  ASSIGNMENT_SORT_FIELDS,
  ASSIGNMENT_SORT_LABELS,
  ASSIGNMENT_VIEW_LABELS,
  ASSIGNMENT_VIEWS,
  PRIORITY,
  PRIORITY_LABELS,
  type AssignmentView,
} from '@painel/shared';
import { useAssignmentCounts } from '@/hooks/use-assignments';
import { useSubjects } from '@/hooks/use-subjects';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AssignmentList } from '@/components/assignments/assignment-list';
import { AssignmentFormDialog } from '@/components/assignments/assignment-form-dialog';
import { cn } from '@/lib/utils';

const ALL = '__all__';

/** Listagem de atividades com recortes rapidos, filtros e ordenacao. */
export default function AssignmentsPage() {
  const [view, setView] = useState<AssignmentView>('pendentes');
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [sortBy, setSortBy] = useState('dueDate');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const { data: counts } = useAssignmentCounts();
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const params = useMemo(
    () => ({
      view,
      search: debouncedSearch || undefined,
      subjectId: subjectId === ALL ? undefined : subjectId,
      priority: priority === ALL ? undefined : priority,
      sortBy,
      order,
      page,
      perPage: 20,
    }),
    [view, debouncedSearch, subjectId, priority, sortBy, order, page],
  );

  const hasActiveFilters = debouncedSearch !== '' || subjectId !== ALL || priority !== ALL;

  /** Qualquer mudanca de filtro volta para a primeira pagina. */
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const clearFilters = (): void => {
    setSearch('');
    setSubjectId(ALL);
    setPriority(ALL);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Atividades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts
              ? `${counts.pendentes} em aberto · ${counts.atrasadas} atrasadas`
              : 'Carregando...'}
          </p>
        </div>

        <Button variant="accent" onClick={() => setFormOpen(true)} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nova atividade</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Recortes rápidos: abas sublinhadas, rolam horizontalmente no celular. */}
      <div
        className="-mx-4 flex gap-5 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Filtros rápidos"
      >
        {ASSIGNMENT_VIEWS.map((item) => {
          const isActive = view === item;
          const count = counts?.[item];

          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setView(item);
                setPage(1);
              }}
              className={cn(
                'relative shrink-0 pb-2.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-none',
                isActive
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {ASSIGNMENT_VIEW_LABELS[item]}
              {count !== undefined && (
                <span className="ml-1.5 text-xs text-muted-foreground/70">{count}</span>
              )}

              {isActive && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            placeholder="Buscar atividade"
            aria-label="Buscar atividades"
            className="pl-8"
          />
        </div>

        <Select value={subjectId} onValueChange={resetPage(setSubjectId)}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as disciplinas</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={resetPage(setPriority)}>
          <SelectTrigger className="sm:w-40" aria-label="Filtrar por prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda prioridade</SelectItem>
            {PRIORITY.map((item) => (
              <SelectItem key={item} value={item}>
                {PRIORITY_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${sortBy}:${order}`}
          onValueChange={(combined) => {
            const [field, direction] = combined.split(':');
            setSortBy(field ?? 'dueDate');
            setOrder(direction ?? 'asc');
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Ordenar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNMENT_SORT_FIELDS.flatMap((field) => [
              <SelectItem key={`${field}:asc`} value={`${field}:asc`}>
                {ASSIGNMENT_SORT_LABELS[field]} ↑
              </SelectItem>,
              <SelectItem key={`${field}:desc`} value={`${field}:desc`}>
                {ASSIGNMENT_SORT_LABELS[field]} ↓
              </SelectItem>,
            ])}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-4" aria-hidden />
            Limpar
          </Button>
        )}
      </div>

      <AssignmentList
        params={params}
        onPageChange={setPage}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <AssignmentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
