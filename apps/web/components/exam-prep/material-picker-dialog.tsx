'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useAttachments } from '@/hooks/use-attachments';
import { useAddExamPrepMaterial } from '@/hooks/use-exam-preps';
import { TYPE_ICONS } from '@/components/materials/attachment-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MaterialPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examPrepId: string;
  /** Materiais já vinculados ao plano - somem da lista pra não oferecer de novo. */
  linkedAttachmentIds: string[];
}

/**
 * Vincula um material JÁ EXISTENTE ao plano - mesmo padrão do seletor "já
 * tenho essa disciplina" das Turmas (busca + checkbox múltiplo). O material
 * continua pertencendo a onde já estava; isso só cria a referência.
 */
export function MaterialPickerDialog({
  open,
  onOpenChange,
  examPrepId,
  linkedAttachmentIds,
}: MaterialPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useAttachments({ search: search.trim() || undefined, perPage: 50 });
  const addMaterial = useAddExamPrepMaterial(examPrepId);

  const linkedSet = new Set(linkedAttachmentIds);
  const available = (data?.data ?? []).filter((attachment) => !linkedSet.has(attachment.id));

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const handleConfirm = async (): Promise<void> => {
    setAdding(true);

    try {
      for (const attachmentId of selected) {
        await addMaterial.mutateAsync({ attachmentId });
      }

      setSelected(new Set());
      setSearch('');
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelected(new Set());
          setSearch('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar material ao plano</DialogTitle>
          <DialogDescription>
            O vínculo é uma referência - o material continua onde já estava.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar material"
            aria-label="Buscar material"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : available.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search
                ? 'Nenhum material encontrado.'
                : 'Todos os seus materiais já estão vinculados a este plano.'}
            </p>
          ) : (
            available.map((attachment) => {
              const Icon = TYPE_ICONS[attachment.type];

              return (
                <label
                  key={attachment.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(attachment.id)}
                    onChange={() => toggle(attachment.id)}
                    className="size-4 shrink-0 rounded border-input accent-primary"
                  />
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={selected.size === 0 || adding}
            onClick={() => void handleConfirm()}
          >
            {adding && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
