'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useBulkCreateExamPrepItems } from '@/hooks/use-exam-preps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TransformContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examPrepId: string;
  content: string;
}

/** Só quebra em linhas e tira marcadores comuns - nunca interpreta ou resume (§4 do plano). */
function splitLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•☐☑]\s*/, ''))
    .filter((line) => line.length > 0)
    .slice(0, 50);
}

/**
 * "Transformar em itens" (Etapa 5): o aluno decide o que vira item, o
 * sistema só propõe a partir das linhas do `Exam.content` - o resultado é
 * sempre revisável e editável antes de salvar, nunca aplicado direto.
 */
export function TransformContentDialog({
  open,
  onOpenChange,
  examPrepId,
  content,
}: TransformContentDialogProps) {
  const [lines, setLines] = useState<string[]>([]);
  const bulkCreate = useBulkCreateExamPrepItems(examPrepId);

  useEffect(() => {
    if (open) setLines(splitLines(content));
  }, [open, content]);

  const updateLine = (index: number, value: string): void => {
    setLines((current) => current.map((line, i) => (i === index ? value : line)));
  };

  const removeLine = (index: number): void => {
    setLines((current) => current.filter((_, i) => i !== index));
  };

  const handleConfirm = async (): Promise<void> => {
    const titles = lines.map((line) => line.trim()).filter((line) => line.length > 0);

    if (titles.length === 0) return;

    await bulkCreate.mutateAsync({ titles });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transformar conteúdo em itens</DialogTitle>
          <DialogDescription>
            Cada linha vira um item de Conteúdos. Edite ou remova o que não servir antes de
            adicionar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nada pra transformar - o conteúdo cadastrado na prova está vazio.
            </p>
          ) : (
            lines.map((line, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={line}
                  onChange={(event) => updateLine(index, event.target.value)}
                  maxLength={200}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeLine(index)}
                  aria-label="Remover esta linha"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={lines.length === 0 || bulkCreate.isPending}
            onClick={() => void handleConfirm()}
          >
            <Sparkles className="size-4" aria-hidden />
            Adicionar {lines.length > 0 ? `(${lines.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
