'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  FileDown,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  FLASHCARD_VIEWS,
  FLASHCARD_VIEW_LABELS,
  type FlashcardListItem,
  type FlashcardView,
} from '@painel/shared';
import { useDeck, useDeckCards, useDeleteFlashcard } from '@/hooks/use-flashcards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CardFormDialog } from '@/components/flashcards/card-form-dialog';
import { ImportCardsDialog } from '@/components/flashcards/import-cards-dialog';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 30;

/** Rótulo do agendamento do cartão, em linguagem natural. */
function scheduleLabel(card: FlashcardListItem): string {
  if (card.isNew) return 'Nunca estudado';
  if (card.isDue) return 'Para revisar hoje';
  if (card.dueDate === null) return '—';

  return `Volta em ${formatDate(card.dueDate)}`;
}

export default function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [view, setView] = useState<FlashcardView>('todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<FlashcardListItem | null>(null);
  const [deleting, setDeleting] = useState<FlashcardListItem | null>(null);

  const { data: deck, isLoading: isLoadingDeck, isError } = useDeck(id);
  const deleteCard = useDeleteFlashcard();

  const { data, isLoading } = useDeckCards(id, {
    page,
    perPage: PAGE_SIZE,
    view,
    search: search.trim() || undefined,
  });

  const cards = data?.data ?? [];

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Baralho não encontrado"
            description="Ele pode ter sido excluído."
            action={
              <Button asChild size="sm">
                <Link href="/flashcards">
                  <ArrowLeft className="size-4" aria-hidden />
                  Voltar aos baralhos
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/flashcards">
          <ArrowLeft className="size-4" aria-hidden />
          Baralhos
        </Link>
      </Button>

      {isLoadingDeck || !deck ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: deck.color }}
                aria-hidden
              />
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {deck.name}
              </h1>
            </div>

            {deck.description && (
              <p className="mt-1 text-sm text-muted-foreground">{deck.description}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {deck.subject && <Badge variant="outline">{deck.subject.name}</Badge>}
              <Badge variant="secondary">{deck.totalCards} cartões</Badge>
              {deck.dueCards > 0 && <Badge variant="pending">{deck.dueCards} para revisar</Badge>}
              {deck.masteredCards > 0 && (
                <Badge variant="completed">{deck.masteredCards} dominados</Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileDown className="size-4" aria-hidden />
              Importar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null);
                setCardFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Cartão
            </Button>

            {deck.dueCards > 0 && (
              <Button asChild size="sm">
                <Link href={`/flashcards/${id}/estudar`}>
                  <Play className="size-4" aria-hidden />
                  Estudar {deck.dueCards}
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={view}
          onValueChange={(value) => {
            setView(value as FlashcardView);
            setPage(1);
          }}
          className="min-w-0"
        >
          <TabsList>
            {FLASHCARD_VIEWS.map((item) => (
              <TabsTrigger key={item} value={item}>
                {FLASHCARD_VIEW_LABELS[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar cartão"
            aria-label="Buscar cartões"
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title={
              search || view !== 'todos' ? 'Nenhum cartão neste recorte' : 'Nenhum cartão ainda'
            }
            description={
              search || view !== 'todos'
                ? 'Ajuste a busca ou troque a aba.'
                : 'Adicione cartões um a um ou cole uma lista pronta.'
            }
            action={
              search || view !== 'todos' ? undefined : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setCardFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Adicionar cartão
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                    <FileDown className="size-4" aria-hidden />
                    Importar lista
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.id}>
                {/* `flex-row` explicito: o Card traz `flex-col` por padrao. */}
                <Card
                  className="flex min-w-0 flex-row items-start gap-3 p-3"
                  data-testid="card-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{card.front}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{card.back}</p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={card.isNew ? 'secondary' : card.isDue ? 'pending' : 'outline'}
                      >
                        {scheduleLabel(card)}
                      </Badge>

                      {card.totalReviews > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {card.totalReviews} {card.totalReviews === 1 ? 'revisão' : 'revisões'}
                          {card.lapses > 0 && ` · ${card.lapses} erro(s)`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Editar ${card.front}`}
                      onClick={() => {
                        setEditing(card);
                        setCardFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      aria-label={`Excluir ${card.front}`}
                      onClick={() => setDeleting(card)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasPreviousPage}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>

              <Badge variant="secondary">
                {data.meta.page} de {data.meta.totalPages}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <CardFormDialog
        open={cardFormOpen}
        onOpenChange={(open) => {
          setCardFormOpen(open);
          if (!open) setEditing(null);
        }}
        deckId={id}
        card={editing}
      />

      <ImportCardsDialog open={importOpen} onOpenChange={setImportOpen} deckId={id} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico de revisões dele será apagado junto.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>

            <Button
              variant="destructive"
              disabled={deleteCard.isPending}
              onClick={async () => {
                if (!deleting) return;

                await deleteCard.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
