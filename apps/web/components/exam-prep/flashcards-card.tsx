'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers, Play, Plus } from 'lucide-react';
import { useDecks } from '@/hooks/use-flashcards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DeckFormDialog } from '@/components/flashcards/deck-form-dialog';

interface FlashcardsCardProps {
  examPrepId: string;
}

/**
 * Flashcards do plano (Etapa 8): `Deck.examPrepId` em uso. Fluxo de estudo
 * (fila, SM-2, avaliação de 4 níveis) continua sendo exatamente o de
 * `/flashcards/[id]` - aqui só cria e lista, o resto é o mesmo de sempre.
 */
export function FlashcardsCard({ examPrepId }: FlashcardsCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const { data: decks, isLoading } = useDecks({ examPrepId });

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Flashcards</h2>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Novo baralho
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !decks || decks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum baralho criado neste plano ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/flashcards/${deck.id}`}
                className="flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-accent/40"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${deck.color}1f`, color: deck.color }}
                  aria-hidden
                >
                  <Layers className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{deck.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {deck.totalCards} cartões
                    </Badge>
                    {deck.masteredCards > 0 && (
                      <Badge variant="completed" className="text-[10px]">
                        {deck.masteredCards} dominados
                      </Badge>
                    )}
                  </div>
                </div>

                {deck.dueCards > 0 && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                    <Play className="size-3" aria-hidden />
                    {deck.dueCards}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <DeckFormDialog open={formOpen} onOpenChange={setFormOpen} examPrepId={examPrepId} />
    </Card>
  );
}
