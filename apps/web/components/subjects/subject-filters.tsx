'use client';

import { Search, X } from 'lucide-react';
import { SUBJECT_STATUS, SUBJECT_STATUS_LABELS, SUBJECT_SORT_FIELDS } from '@painel/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Rotulos dos campos de ordenacao. */
const SORT_LABELS: Record<(typeof SUBJECT_SORT_FIELDS)[number], string> = {
  name: 'Nome',
  average: 'Média',
  code: 'Código',
  createdAt: 'Data de criação',
};

const ALL = '__all__';

export interface SubjectFiltersState {
  search: string;
  status: string;
  sortBy: string;
  order: string;
  includeArchived: boolean;
}

interface SubjectFiltersProps {
  value: SubjectFiltersState;
  onChange: (value: SubjectFiltersState) => void;
}

export function SubjectFilters({ value, onChange }: SubjectFiltersProps) {
  const update = (patch: Partial<SubjectFiltersState>): void => {
    onChange({ ...value, ...patch });
  };

  const hasActiveFilters =
    value.search !== '' || value.status !== ALL || value.includeArchived || value.sortBy !== 'name';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={value.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="Buscar por nome, código ou professor"
          aria-label="Buscar disciplinas"
          className="pl-8"
        />
      </div>

      <Select value={value.status} onValueChange={(status) => update({ status })}>
        <SelectTrigger className="sm:w-40" aria-label="Filtrar por situação">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {SUBJECT_STATUS.map((status) => (
            <SelectItem key={status} value={status}>
              {SUBJECT_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${value.sortBy}:${value.order}`}
        onValueChange={(combined) => {
          const [sortBy, order] = combined.split(':');
          update({ sortBy: sortBy ?? 'name', order: order ?? 'asc' });
        }}
      >
        <SelectTrigger className="sm:w-48" aria-label="Ordenar por">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {SUBJECT_SORT_FIELDS.flatMap((field) => [
            <SelectItem key={`${field}:asc`} value={`${field}:asc`}>
              {SORT_LABELS[field]} ↑
            </SelectItem>,
            <SelectItem key={`${field}:desc`} value={`${field}:desc`}>
              {SORT_LABELS[field]} ↓
            </SelectItem>,
          ])}
        </SelectContent>
      </Select>

      <Button
        variant={value.includeArchived ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => update({ includeArchived: !value.includeArchived })}
        aria-pressed={value.includeArchived}
      >
        Arquivadas
      </Button>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              search: '',
              status: ALL,
              sortBy: 'name',
              order: 'asc',
              includeArchived: false,
            })
          }
        >
          <X className="size-4" aria-hidden />
          Limpar
        </Button>
      )}
    </div>
  );
}

export { ALL as ALL_STATUS };
