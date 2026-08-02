'use client';

import { useMemo, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useCreateFlashcards } from '@/hooks/use-flashcards';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImportCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
}

/** Separadores aceitos, em ordem de prioridade. */
const SEPARATORS = ['\t', ';', ' - '] as const;

interface ParsedCard {
  front: string;
  back: string;
}

/**
 * Converte texto colado em cartoes.
 *
 * Uma linha por cartao, com frente e verso separados por tabulacao, ponto e
 * virgula ou hifen cercado de espacos. A tabulacao vem primeiro porque e o que
 * sai ao copiar de uma planilha - o caso mais comum de quem ja tem a lista
 * pronta.
 */
function parseCards(text: string): { cards: ParsedCard[]; invalidLines: number[] } {
  const cards: ParsedCard[] = [];
  const invalidLines: number[] = [];

  text.split('\n').forEach((rawLine, position) => {
    const line = rawLine.trim();

    if (line === '') return;

    const separator = SEPARATORS.find((candidate) => line.includes(candidate));

    if (!separator) {
      invalidLines.push(position + 1);
      return;
    }

    // Só o primeiro separador divide: uma resposta pode conter ponto e vírgula.
    const splitAt = line.indexOf(separator);
    const front = line.slice(0, splitAt).trim();
    const back = line.slice(splitAt + separator.length).trim();

    if (front === '' || back === '') {
      invalidLines.push(position + 1);
      return;
    }

    cards.push({ front, back });
  });

  return { cards, invalidLines };
}

export function ImportCardsDialog({ open, onOpenChange, deckId }: ImportCardsDialogProps) {
  const [text, setText] = useState('');
  const createCards = useCreateFlashcards();

  const { cards, invalidLines } = useMemo(() => parseCards(text), [text]);

  const handleImport = async (): Promise<void> => {
    try {
      await createCards.mutateAsync({ deckId, cards });
      setText('');
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar cartões</DialogTitle>
          <DialogDescription>
            Um cartão por linha, com pergunta e resposta separadas por tabulação,{' '}
            <code className="rounded bg-muted px-1">;</code> ou{' '}
            <code className="rounded bg-muted px-1"> - </code>. Colar direto de uma planilha
            funciona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            aria-label="Cartões para importar"
            placeholder={
              'Derivada de sen(x); cos(x)\nDerivada de cos(x); -sen(x)\nDerivada de e^x; e^x'
            }
            className="font-mono text-sm"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={cards.length > 0 ? 'completed' : 'secondary'}>
              {cards.length} {cards.length === 1 ? 'cartão reconhecido' : 'cartões reconhecidos'}
            </Badge>

            {invalidLines.length > 0 && (
              <Badge variant="overdue">
                {invalidLines.length === 1
                  ? `linha ${invalidLines[0]} sem separador`
                  : `${invalidLines.length} linhas sem separador`}
              </Badge>
            )}
          </div>

          {cards.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {cards.slice(0, 5).map((card, position) => (
                <div key={position} className="flex min-w-0 items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium">{card.front}</span>
                  <span className="shrink-0 text-muted-foreground">→</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{card.back}</span>
                </div>
              ))}

              {cards.length > 5 && (
                <p className="pt-1 text-[11px] text-muted-foreground">e mais {cards.length - 5}…</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            onClick={() => void handleImport()}
            disabled={cards.length === 0 || createCards.isPending}
          >
            {createCards.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="size-4" aria-hidden />
            )}
            Importar {cards.length > 0 && cards.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
