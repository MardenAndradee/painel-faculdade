'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Clock,
  EllipsisVertical,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useExamPrep } from '@/hooks/use-exam-preps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompletionBar } from '@/components/exam-prep/completion-bar';
import { ItemChecklist } from '@/components/exam-prep/item-checklist';
import { TransformContentDialog } from '@/components/exam-prep/transform-content-dialog';
import { NotesCard } from '@/components/exam-prep/notes-card';
import { MaterialsCard } from '@/components/exam-prep/materials-card';
import { FlashcardsCard } from '@/components/exam-prep/flashcards-card';
import { StudySessionCard } from '@/components/exam-prep/study-session-card';
import { DeleteExamPrepDialog } from '@/components/exam-prep/delete-exam-prep-dialog';
import { shortMinutes } from '@/components/charts/chart-primitives';
import { formatDate } from '@/lib/format';

/**
 * Dashboard do Plano de Estudos (Etapa 27, rótulo; nome interno `ExamPrep`).
 *
 * Cabeçalho + progresso (Etapa 4), Conteúdos (Etapa 5), Anotações (Etapa 6),
 * Materiais (Etapa 7), Flashcards (Etapa 8) e Sessões de estudo (Etapa 9),
 * no mesmo padrão de card-por-seção que `/cronograma` já usa. Objetivos
 * saiu de escopo — a tabela nasceu preparada para os dois, mas só
 * Conteúdos chegou a ser usado.
 */
export default function ExamPrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: plan, isLoading, isError } = useExamPrep(id);
  const [transformOpen, setTransformOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Plano não encontrado"
            description="Ele pode ter sido excluído, ou a prova associada não existe mais."
            action={
              <Button asChild size="sm">
                <Link href="/provas">
                  <ArrowLeft className="size-4" aria-hidden />
                  Voltar às provas
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/provas">
            <ArrowLeft className="size-4" aria-hidden />
            Provas
          </Link>
        </Button>

        {plan && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações do plano">
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                Excluir plano
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isLoading || !plan ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              <BookOpen className="size-4.5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: plan.subject.color }}
                  aria-hidden
                />
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {plan.subject.name}
                  {plan.semester && ` · ${plan.semester.name}`}
                </p>
              </div>

              <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
                Plano de Estudos — {plan.exam.title}
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Prova em {formatDate(plan.exam.date)}
              </p>
            </div>
          </div>

          <CompletionBar rate={plan.progress.itemsCompletionRate} />

          <div className="grid grid-cols-3 gap-3 border-t pt-3.5">
            <div>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Conteúdos
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {plan.progress.contentsDone}/{plan.progress.contentsTotal}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Flashcards
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {plan.flashcards.masteredCount}/{plan.flashcards.cardCount} dominados
              </p>
            </div>

            <div>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Tempo estudado
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                {shortMinutes(plan.progress.studiedMinutes)}
              </p>
            </div>
          </div>

          {plan.exam.content && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Conteúdo cadastrado na prova
                </p>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-xs"
                  onClick={() => setTransformOpen(true)}
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  Transformar em itens
                </Button>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line">{plan.exam.content}</p>
            </div>
          )}
        </Card>
      )}

      {plan && (
        <>
          <StudySessionCard examPrepId={plan.id} activeSession={plan.activeStudySession} />

          <ItemChecklist examPrepId={plan.id} items={plan.contents} />

          <NotesCard examPrepId={plan.id} notes={plan.notes} />

          <MaterialsCard
            examPrepId={plan.id}
            materials={plan.materials}
            suggestedMaterials={plan.suggestedMaterials}
          />

          <FlashcardsCard examPrepId={plan.id} />

          {plan.exam.content && (
            <TransformContentDialog
              open={transformOpen}
              onOpenChange={setTransformOpen}
              examPrepId={plan.id}
              content={plan.exam.content}
            />
          )}

          <DeleteExamPrepDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            examPrepId={plan.id}
          />
        </>
      )}
    </div>
  );
}
