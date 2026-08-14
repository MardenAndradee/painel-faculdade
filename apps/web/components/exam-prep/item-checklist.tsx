'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, CircleDashed, Plus, Trash2 } from 'lucide-react';
import {
  EXAM_PREP_ITEM_STATUS_LABELS,
  type ExamPrepItem,
  type ExamPrepItemStatus,
} from '@painel/shared';
import {
  useCreateExamPrepItem,
  useDeleteExamPrepItem,
  useUpdateExamPrepItem,
} from '@/hooks/use-exam-preps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Clique avança um estado - mesma ideia de um checkbox de três posições. */
const STATUS_CYCLE: Record<ExamPrepItemStatus, ExamPrepItemStatus> = {
  NOT_STARTED: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'NOT_STARTED',
};

const STATUS_ICON: Record<ExamPrepItemStatus, typeof Circle> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  DONE: CheckCircle2,
};

const STATUS_COLOR: Record<ExamPrepItemStatus, string> = {
  NOT_STARTED: 'text-muted-foreground',
  IN_PROGRESS: 'text-status-pending',
  DONE: 'text-status-completed',
};

interface ItemChecklistProps {
  examPrepId: string;
  items: ExamPrepItem[];
}

/** Checklist de Conteúdos do plano - "o que estudar". */
export function ItemChecklist({ examPrepId, items }: ItemChecklistProps) {
  const [draft, setDraft] = useState('');
  const createItem = useCreateExamPrepItem(examPrepId);
  const updateItem = useUpdateExamPrepItem(examPrepId);
  const deleteItem = useDeleteExamPrepItem(examPrepId);

  const done = items.filter((item) => item.status === 'DONE').length;

  const handleAdd = (): void => {
    const value = draft.trim();

    if (!value) return;

    createItem.mutate({ title: value });
    setDraft('');
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Conteúdos</h2>
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {done} de {items.length} concluídos
          </p>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = STATUS_ICON[item.status];

            return (
              <li
                key={item.id}
                className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    updateItem.mutate({
                      itemId: item.id,
                      data: { status: STATUS_CYCLE[item.status] },
                    })
                  }
                  className={cn('shrink-0 transition-colors', STATUS_COLOR[item.status])}
                  aria-label={`${item.title} - status: ${EXAM_PREP_ITEM_STATUS_LABELS[item.status]}. Clique pra avançar`}
                >
                  <Icon className="size-4" aria-hidden />
                </button>

                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    item.status === 'DONE' && 'text-muted-foreground line-through',
                  )}
                >
                  {item.title}
                </span>

                <button
                  type="button"
                  onClick={() => deleteItem.mutate(item.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Excluir ${item.title}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder="O que estudar (ex.: Modelo OSI)"
          maxLength={200}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={!draft.trim() || createItem.isPending}
          aria-label="Adicionar conteúdo"
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
