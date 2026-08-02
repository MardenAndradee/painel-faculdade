'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  Brain,
  EllipsisVertical,
  Flame,
  Layers,
  Pencil,
  Play,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import type { DeckListItem } from '@painel/shared';
import { useArchiveDeck, useDecks, useDeleteDeck, useFlashcardStats } from '@/hooks/use-flashcards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DeckFormDialog } from '@/components/flashcards/deck-form-dialog';
import { formatRelative } from '@/lib/format';

function DeckCard({
  deck,
  onEdit,
  onArchive,
  onDelete,
}: {
  deck: DeckListItem;
  onEdit: (deck: DeckListItem) => void;
  onArchive: (deck: DeckListItem) => void;
  onDelete: (deck: DeckListItem) => void;
}) {
  const isArchived = deck.archivedAt !== null;
  const hasDue = deck.dueCards > 0;

  // Barra de progresso: quanto do baralho já virou conhecimento consolidado.
  const masteredPercent =
    deck.totalCards === 0 ? 0 : Math.round((deck.masteredCards / deck.totalCards) * 100);

  return (
    <Card
      className={`flex min-w-0 flex-col gap-3 p-4 ${isArchived ? 'opacity-60' : ''}`}
      data-testid="deck-card"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-1 size-3 shrink-0 rounded-full"
          style={{ backgroundColor: deck.color }}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <Link
            href={`/flashcards/${deck.id}`}
            className="line-clamp-2 text-sm font-medium transition-colors hover:text-primary"
          >
            {deck.name}
          </Link>

          {deck.subject && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{deck.subject.name}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Ações de ${deck.name}`}
            >
              <EllipsisVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(deck)}>
              <Pencil aria-hidden />
              Editar
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onArchive(deck)}>
              {isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {isArchived ? 'Reativar' : 'Arquivar'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => onDelete(deck)}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="secondary">{deck.totalCards} cartões</Badge>

        {hasDue && <Badge variant="pending">{deck.dueCards} para revisar</Badge>}

        {deck.masteredCards > 0 && (
          <Badge variant="completed">{deck.masteredCards} dominados</Badge>
        )}

        {isArchived && <Badge variant="outline">Arquivado</Badge>}
      </div>

      {deck.totalCards > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-status-completed transition-all"
              style={{ width: `${masteredPercent}%` }}
              role="progressbar"
              aria-valuenow={masteredPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${masteredPercent}% dominado`}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {masteredPercent}% dominado
            {deck.lastStudiedAt &&
              ` · estudado ${formatRelative(deck.lastStudiedAt).toLowerCase()}`}
          </p>
        </div>
      )}

      <Button
        asChild={!isArchived && hasDue}
        size="sm"
        variant={hasDue ? 'default' : 'outline'}
        disabled={isArchived || !hasDue}
        className="mt-auto"
      >
        {!isArchived && hasDue ? (
          <Link href={`/flashcards/${deck.id}/estudar`}>
            <Play className="size-4" aria-hidden />
            Estudar {deck.dueCards}
          </Link>
        ) : (
          <span>
            <Play className="size-4" aria-hidden />
            {deck.totalCards === 0 ? 'Sem cartões' : 'Em dia'}
          </span>
        )}
      </Button>
    </Card>
  );
}

export default function FlashcardsPage() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeckListItem | null>(null);
  const [deleting, setDeleting] = useState<DeckListItem | null>(null);

  const { data: decks, isLoading } = useDecks({ search: search.trim() || undefined });
  const { data: stats } = useFlashcardStats();
  const archiveDeck = useArchiveDeck();
  const deleteDeck = useDeleteDeck();

  const totalDue =
    decks?.reduce((sum, deck) => sum + (deck.archivedAt ? 0 : deck.dueCards), 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Flashcards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisão espaçada: cada cartão volta quando você está prestes a esquecê-lo.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo baralho</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Para revisar hoje</p>
            <Brain className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats?.dueToday ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats?.newCards ? `${stats.newCards} nunca estudados` : 'em dia com os novos'}
          </p>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Revisados hoje</p>
            <Target className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats?.reviewedToday ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats?.retentionRate === null || stats?.retentionRate === undefined
              ? 'sem revisões ainda'
              : `${stats.retentionRate}% de acerto`}
          </p>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Sequência</p>
            <Flame className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats?.streakDays ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats?.streakDays === 1 ? 'dia seguido' : 'dias seguidos'}
          </p>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Dominados</p>
            <Layers className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats?.masteredCards ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            de {stats?.totalCards ?? 0} cartões
          </p>
        </Card>
      </div>

      {totalDue > 0 && (
        <Card className="flex flex-col items-start gap-3 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {totalDue} {totalDue === 1 ? 'cartão espera' : 'cartões esperam'} por você
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Estude tudo de uma vez, misturando os baralhos.
            </p>
          </div>

          <Button asChild size="sm" className="shrink-0">
            <Link href="/flashcards/estudar">
              <Play className="size-4" aria-hidden />
              Estudar tudo
            </Link>
          </Button>
        </Card>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar baralho"
          aria-label="Buscar baralhos"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !decks || decks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title={search ? 'Nenhum baralho encontrado' : 'Nenhum baralho ainda'}
            description={
              search
                ? 'Tente outro termo de busca.'
                : 'Crie um baralho para começar a estudar com revisão espaçada.'
            }
            action={
              search ? (
                <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                  Limpar busca
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Criar baralho
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onArchive={(item) =>
                archiveDeck.mutate({ id: item.id, archived: item.archivedAt === null })
              }
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <DeckFormDialog open={formOpen} onOpenChange={setFormOpen} deck={editing} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {deleting?.totalCards ?? 0} cartões e todo o progresso de revisão serão apagados.
              Para apenas tirá-lo da fila de estudo, use <strong>Arquivar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>

            <Button
              variant="destructive"
              disabled={deleteDeck.isPending}
              onClick={async () => {
                if (!deleting) return;

                await deleteDeck.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir baralho
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
