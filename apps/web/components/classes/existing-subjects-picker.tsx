'use client';

import { useState } from 'react';
import { Library } from 'lucide-react';
import type { SubjectListItem } from '@painel/shared';
import { useSubjects } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { subjectInitials } from '@/lib/format';

interface ExistingSubjectsPickerProps {
  /** Ids já adicionados nesta sessão - somem da lista para não duplicar. */
  excludeIds?: string[];
  onConfirm: (subjects: SubjectListItem[]) => void;
}

/**
 * Escolhe disciplinas PESSOAIS já existentes para virar disciplina-molde da
 * turma, vinculando direto por id (sem depender do casamento por nome) - ver
 * decisão no README, Etapa 24.1.
 */
export function ExistingSubjectsPicker({
  excludeIds = [],
  onConfirm,
}: ExistingSubjectsPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useSubjects({ page: 1, perPage: 100 });
  const available = (data?.data ?? []).filter((subject) => !excludeIds.includes(subject.id));

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const allSelected =
    available.length > 0 && available.every((subject) => selected.has(subject.id));

  const toggleAll = (): void => {
    setSelected(allSelected ? new Set() : new Set(available.map((subject) => subject.id)));
  };

  const handleConfirm = (): void => {
    onConfirm(available.filter((subject) => selected.has(subject.id)));
    setSelected(new Set());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected(new Set());
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Library className="size-3.5" aria-hidden />
          Já tenho essa disciplina
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-medium">Minhas disciplinas</p>
          {available.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleAll}
            >
              {allSelected ? 'Limpar' : 'Selecionar todas'}
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : available.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Nenhuma disciplina disponível para vincular.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {available.map((subject) => (
                <li key={subject.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50">
                    <input
                      type="checkbox"
                      checked={selected.has(subject.id)}
                      onChange={() => toggle(subject.id)}
                      className="size-4 shrink-0 rounded border-input accent-primary"
                    />
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
                      style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
                      aria-hidden
                    >
                      {subjectInitials(subject.name, subject.code)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{subject.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
