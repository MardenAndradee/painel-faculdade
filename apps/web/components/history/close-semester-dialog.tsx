'use client';

import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import type { SemesterListItem } from '@painel/shared';
import { useCloseSemester, useClosePreview } from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatGrade } from '@/lib/format';

interface CloseSemesterDialogProps {
  semester: SemesterListItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmação de encerramento.
 *
 * Mostra exatamente o que será gravado em cada disciplina antes de confirmar:
 * encerrar congela as médias, e o usuário precisa ver o resultado antes.
 */
export function CloseSemesterDialog({ semester, onOpenChange }: CloseSemesterDialogProps) {
  const isOpen = semester !== null;
  const { data: preview, isLoading } = useClosePreview(semester?.id ?? '', isOpen);
  const closeSemester = useCloseSemester();

  if (!semester) return null;

  const handleClose = async (): Promise<void> => {
    await closeSemester.mutateAsync(semester.id);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="size-5 shrink-0" aria-hidden />
            Encerrar {semester.name}?
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div>
              <p>
                Isso só <strong className="text-foreground">congela suas notas</strong> — você já
                está automaticamente no semestre seguinte, calculado pelo calendário. Editar uma
                nota depois disso não altera mais o histórico deste período.
              </p>

              {isLoading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : preview && preview.subjects.length > 0 ? (
                <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
                  {preview.subjects.map((subject) => (
                    <li
                      key={subject.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-2.5 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {subject.name}
                      </span>

                      <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                        {formatGrade(subject.average)}
                      </span>

                      <Badge
                        variant={
                          subject.resultingStatus === 'APPROVED'
                            ? 'completed'
                            : subject.resultingStatus === 'FAILED'
                              ? 'overdue'
                              : 'secondary'
                        }
                        className="shrink-0"
                      >
                        {subject.resultingStatus === 'APPROVED'
                          ? 'Aprovado'
                          : subject.resultingStatus === 'FAILED'
                            ? 'Reprovado'
                            : 'Sem nota'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3">Este semestre não tem disciplinas vinculadas.</p>
              )}

              {preview && preview.withoutGrades > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-status-pending">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {preview.withoutGrades}{' '}
                  {preview.withoutGrades === 1
                    ? 'disciplina ficará sem média final por não ter notas lançadas.'
                    : 'disciplinas ficarão sem média final por não terem notas lançadas.'}
                </p>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                É possível reabrir o semestre depois, o que descongela as médias.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button onClick={() => void handleClose()} disabled={closeSemester.isPending}>
            {closeSemester.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Encerrar semestre
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
