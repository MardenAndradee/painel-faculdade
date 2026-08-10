'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  EXAM_SORT_FIELDS,
  EXAM_SORT_LABELS,
  EXAM_VIEW_LABELS,
  EXAM_VIEWS,
  type ExamView,
} from '@painel/shared';
import { useExamCounts } from '@/hooks/use-exams';
import { useSubjects } from '@/hooks/use-subjects';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExamList } from '@/components/exams/exam-list';
import { ExamFormDialog } from '@/components/exams/exam-form-dialog';
import { cn } from '@/lib/utils';

const ALL = '__all__';

export default function ExamsPage() {
  const [view, setView] = useState<ExamView>('proximas');
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState(ALL);
  const [sortBy, setSortBy] = useState('date');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const { data: counts } = useExamCounts();
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const params = useMemo(
    () => ({
      view,
      search: debouncedSearch || undefined,
      subjectId: subjectId === ALL ? undefined : subjectId,
      sortBy,
      order,
      page,
      perPage: 20,
    }),
    [view, debouncedSearch, subjectId, sortBy, order, page],
  );

  const hasActiveFilters = debouncedSearch !== '' || subjectId !== ALL;

  const clearFilters = (): void => {
    setSearch('');
    setSubjectId(ALL);
    setPage(1);
  };

  /**
   * Trocar de recorte ajusta a ordem padrao: em "próximas" a mais perto vem
   * primeiro; em "realizadas", a mais recente.
   */
  const changeView = (next: ExamView): void => {
    setView(next);
    setOrder(next === 'realizadas' ? 'desc' : 'asc');
    setSortBy('date');
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Provas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts
              ? `${counts.proximas} ${counts.proximas === 1 ? 'prova a caminho' : 'provas a caminho'}`
              : 'Carregando...'}
          </p>
        </div>

        <Button variant="accent" onClick={() => setFormOpen(true)} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nova prova</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        aria-label="Filtros rápidos"
      >
        {EXAM_VIEWS.map((item) => {
          const isActive = view === item;
          const count = counts?.[item];

          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => changeView(item)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isActive
                  ? 'border-transparent bg-primary font-medium text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {EXAM_VIEW_LABELS[item]}
              {count !== undefined && count > 0 && (
                <Badge
                  variant={isActive ? 'secondary' : 'outline'}
                  className={cn('px-1.5 py-0 text-[11px]', isActive && 'bg-primary-foreground/20')}
                >
                  {count}
                </Badge>
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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por título ou conteúdo"
            aria-label="Buscar provas"
            className="pl-8"
          />
        </div>

        <Select
          value={subjectId}
          onValueChange={(value) => {
            setSubjectId(value);
            setPage(1);
          }}
        >
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

        <Select
          value={`${sortBy}:${order}`}
          onValueChange={(combined) => {
            const [field, direction] = combined.split(':');
            setSortBy(field ?? 'date');
            setOrder(direction ?? 'asc');
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Ordenar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXAM_SORT_FIELDS.flatMap((field) => [
              <SelectItem key={`${field}:asc`} value={`${field}:asc`}>
                {EXAM_SORT_LABELS[field]} ↑
              </SelectItem>,
              <SelectItem key={`${field}:desc`} value={`${field}:desc`}>
                {EXAM_SORT_LABELS[field]} ↓
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

      <ExamList
        params={params}
        onPageChange={setPage}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
