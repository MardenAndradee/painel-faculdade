'use client';

import { AlertTriangle, Archive, Loader2 } from 'lucide-react';
import type { SubjectListItem } from '@painel/shared';
import { useArchiveSubject, useDeleteSubject, useDeletionImpact } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteSubjectDialogProps {
  subject: SubjectListItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmacao de exclusao.
 *
 * Mostra QUANTOS registros seriam destruidos antes de perguntar, e oferece
 * arquivar como alternativa. Excluir uma disciplina remove provas e notas em
 * cascata - o usuario precisa enxergar isso antes de decidir.
 */
export function DeleteSubjectDialog({ subject, onOpenChange }: DeleteSubjectDialogProps) {
  const isOpen = subject !== null;
  const { data: impact, isLoading } = useDeletionImpact(subject?.id ?? '', isOpen);
  const deleteSubject = useDeleteSubject();
  const archiveSubject = useArchiveSubject();

  if (!subject) return null;

  const entries = impact
    ? (
        [
          ['atividade', 'atividades', impact.assignments],
          ['prova', 'provas', impact.exams],
          ['nota', 'notas', impact.grades],
          ['material', 'materiais', impact.attachments],
          ['sessão de estudo', 'sessões de estudo', impact.studySessions],
          ['evento', 'eventos', impact.calendarEvents],
        ] as const
      ).filter(([, , count]) => count > 0)
    : [];

  const totalAffected = entries.reduce((total, [, , count]) => total + count, 0);

  const handleDelete = async (): Promise<void> => {
    await deleteSubject.mutateAsync(subject.id);
    onOpenChange(false);
  };

  const handleArchive = async (): Promise<void> => {
    await archiveSubject.mutateAsync(subject.id);
    onOpenChange(false);
  };

  const isBusy = deleteSubject.isPending || archiveSubject.isPending;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
            Excluir &quot;{subject.name}&quot;?
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div>
              {isLoading ? (
                <div className="space-y-2 py-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : totalAffected === 0 ? (
                <p>Esta disciplina não tem registros vinculados. A exclusão é definitiva.</p>
              ) : (
                <>
                  <p>Esta ação é permanente e também apagará:</p>

                  <ul className="mt-2 space-y-1 text-foreground">
                    {entries.map(([singular, plural, count]) => (
                      <li key={plural} className="flex items-center gap-2 text-sm">
                        <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                        <span className="font-medium tabular-nums">{count}</span>
                        {count === 1 ? singular : plural}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Arquivar preserva tudo e é reversível — por isso vem em destaque. */}
        {subject.archivedAt === null && (
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Archive className="size-4 shrink-0" aria-hidden />
              Prefere arquivar?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A disciplina sai da lista, mas provas, notas e materiais continuam guardados. Pode ser
              desfeito a qualquer momento.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => void handleArchive()}
              disabled={isBusy}
            >
              {archiveSubject.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Arquivar em vez de excluir
            </Button>
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancelar
          </Button>

          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isBusy}>
            {deleteSubject.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Excluir permanentemente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
