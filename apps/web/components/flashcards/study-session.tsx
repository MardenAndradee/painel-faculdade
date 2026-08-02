'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brain, CheckCircle2, Eye, Lightbulb, Loader2, RotateCcw } from 'lucide-react';
import {
  REVIEW_QUALITIES,
  REVIEW_QUALITY_LABELS,
  type ReviewQuality,
  type StudyCard,
} from '@painel/shared';
import {
  useInvalidateFlashcardData,
  useReviewFlashcard,
  useStudyQueue,
} from '@/hooks/use-flashcards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';

interface StudySessionProps {
  /** Sem baralho, a sessão mistura todos. */
  deckId?: string;
  backHref: string;
  title: string;
}

/** Cada nota tem uma cor: a leitura precisa ser instantânea durante o estudo. */
const QUALITY_STYLES: Record<ReviewQuality, string> = {
  0: 'bg-status-overdue/10 text-status-overdue hover:bg-status-overdue/20 border-status-overdue/30',
  3: 'bg-status-pending/10 text-status-pending hover:bg-status-pending/20 border-status-pending/30',
  4: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/30',
  5: 'bg-status-completed/10 text-status-completed hover:bg-status-completed/20 border-status-completed/30',
};

/** Atalhos de teclado: estudar com o mouse trava o ritmo. */
const QUALITY_SHORTCUTS: Record<string, ReviewQuality> = {
  '1': 0,
  '2': 3,
  '3': 4,
  '4': 5,
};

function formatInterval(days: number): string {
  if (days <= 0) return 'hoje';
  if (days === 1) return '1 dia';
  if (days < 30) return `${days} dias`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 mês' : `${months} meses`;
  }

  const years = Math.round(days / 365);
  return years === 1 ? '1 ano' : `${years} anos`;
}

export function StudySession({ deckId, backHref, title }: StudySessionProps) {
  const { data: queue, isLoading, refetch } = useStudyQueue(deckId);
  const reviewCard = useReviewFlashcard();
  const invalidate = useInvalidateFlashcardData();

  const [index, setIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answered, setAnswered] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  /**
   * Os cartões são congelados no início da sessão.
   *
   * Reagir a mudanças da query no meio do estudo trocaria o cartão sob os pés
   * do usuário — e o cartão que ele acabou de responder voltaria para o fim da
   * lista, dando a impressão de que a resposta não foi registrada.
   */
  const [cards, setCards] = useState<StudyCard[] | null>(null);

  useEffect(() => {
    if (queue && cards === null) setCards(queue.cards);
  }, [queue, cards]);

  /** Marca quando o cartão apareceu, para medir o tempo de resposta. */
  const shownAtRef = useRef<number>(Date.now());

  const current = cards?.[index] ?? null;
  const isFinished = cards !== null && index >= cards.length;

  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [index]);

  // Ao terminar, refazer as consultas é justamente o que se quer: contadores,
  // baralhos e estatísticas mudaram.
  useEffect(() => {
    if (isFinished) void invalidate();
  }, [isFinished, invalidate]);

  const handleAnswer = useCallback(
    (quality: ReviewQuality): void => {
      if (!current || reviewCard.isPending) return;

      const durationMs = Date.now() - shownAtRef.current;

      reviewCard.mutate({ id: current.id, data: { quality, durationMs } });

      // Avança na hora, sem esperar a resposta do servidor: a gravação de uma
      // revisão nunca falha por conflito, e travar o fluxo em cada cartão
      // tornaria a sessão sofrível. O toast de erro do hook avisa se algo der
      // errado.
      setAnswered((previous) => ({
        correct: previous.correct + (quality >= 3 ? 1 : 0),
        total: previous.total + 1,
      }));
      setIsRevealed(false);
      setShowHint(false);
      setIndex((previous) => previous + 1);
    },
    [current, reviewCard],
  );

  const reveal = useCallback((): void => setIsRevealed(true), []);

  // Espaço revela; 1–4 avaliam. Só depois de revelado, para não deixar o aluno
  // se auto-avaliar sem ter visto a resposta.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!current) return;

      if (event.code === 'Space' && !isRevealed) {
        event.preventDefault();
        reveal();
        return;
      }

      if (isRevealed && event.key in QUALITY_SHORTCUTS) {
        event.preventDefault();
        handleAnswer(QUALITY_SHORTCUTS[event.key] as ReviewQuality);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, isRevealed, reveal, handleAnswer]);

  const restart = (): void => {
    setCards(null);
    setIndex(0);
    setIsRevealed(false);
    setShowHint(false);
    setAnswered({ correct: 0, total: 0 });
    void refetch();
  };

  if (isLoading || cards === null) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Nada para revisar agora"
            description="Você está em dia. Os cartões voltam automaticamente na data agendada."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={backHref}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Voltar
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (isFinished) {
    const accuracy =
      answered.total === 0 ? 0 : Math.round((answered.correct / answered.total) * 100);

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card className="p-6 text-center sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-status-completed/10">
            <CheckCircle2 className="size-7 text-status-completed" aria-hidden />
          </div>

          <h2 className="mt-4 text-lg font-semibold">Sessão concluída</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {answered.total} {answered.total === 1 ? 'cartão revisado' : 'cartões revisados'} ·{' '}
            {accuracy}% de acerto
          </p>

          {queue && queue.totalDue + queue.totalNew > answered.total && (
            <p className="mt-3 text-xs text-muted-foreground">
              Ainda restam {queue.totalDue + queue.totalNew - answered.total} cartões para hoje.
            </p>
          )}

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="size-4" aria-hidden />
              Continuar estudando
            </Button>

            <Button asChild>
              <Link href={backHref}>
                <ArrowLeft className="size-4" aria-hidden />
                Voltar
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const progress = Math.round((index / cards.length) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      {/* Cabeçalho e progresso */}
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href={backHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Sair
          </Link>
        </Button>

        <p className="min-w-0 truncate text-xs text-muted-foreground" aria-live="polite">
          {index + 1} de {cards.length}
        </p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress}% da sessão`}
        />
      </div>

      {current && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="min-w-0">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: current.deck.color }}
                aria-hidden
              />
              <span className="truncate">{current.deck.name}</span>
            </Badge>

            {current.isNew && <Badge variant="secondary">Novo</Badge>}

            {current.lapses > 0 && (
              <Badge variant="overdue">
                {current.lapses === 1 ? '1 erro antes' : `${current.lapses} erros antes`}
              </Badge>
            )}
          </div>

          {/* O cartão */}
          {/* O cartao centraliza o conteudo verticalmente: `flex` no proprio
              Card, senao o texto sobe para o topo e deixa um vazio embaixo. */}
          <Card
            className="flex min-h-64 items-center justify-center p-6 sm:p-8"
            data-testid="study-card"
          >
            <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
              <p
                className="text-lg leading-relaxed font-medium break-words"
                data-testid="card-front"
              >
                {current.front}
              </p>

              {!isRevealed && current.hint && (
                <>
                  {showHint ? (
                    <p className="text-sm text-muted-foreground italic" data-testid="card-hint">
                      {current.hint}
                    </p>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                      <Lightbulb className="size-4" aria-hidden />
                      Ver dica
                    </Button>
                  )}
                </>
              )}

              {isRevealed && (
                <>
                  <div className="h-px w-full bg-border" aria-hidden />
                  <p
                    className="text-lg leading-relaxed break-words text-foreground"
                    data-testid="card-back"
                  >
                    {current.back}
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* Ações */}
          {!isRevealed ? (
            <Button className="w-full" size="lg" onClick={reveal} data-testid="reveal-button">
              <Eye className="size-4" aria-hidden />
              Mostrar resposta
              <kbd className="ml-2 hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] sm:inline">
                espaço
              </kbd>
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                Quanto você lembrava disso?
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REVIEW_QUALITIES.map((quality, position) => (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => handleAnswer(quality)}
                    data-testid={`quality-${quality}`}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${QUALITY_STYLES[quality]}`}
                  >
                    <span>{REVIEW_QUALITY_LABELS[quality]}</span>
                    {/* Mostrar a consequência antes do clique: sem isso, "Bom"
                        e "Fácil" viram escolha arbitrária. */}
                    <span className="text-[11px] font-normal opacity-80">
                      {formatInterval(current.intervalPreview[String(quality)] ?? 0)}
                    </span>
                    <kbd className="hidden text-[10px] opacity-60 sm:inline">{position + 1}</kbd>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {reviewCard.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden />
                salvando…
              </>
            ) : (
              <>
                <Brain className="size-3" aria-hidden />
                {title}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
