'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { defaultSemesterName } from '@painel/shared';
import { useFinishSemester, useFinishSemesterPreview } from '@/hooks/use-classes';
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

interface FinishSemesterDialogProps {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmação de "Finalizar semestre" (Etapa 30.5).
 *
 * Mostra o que vai mudar antes de confirmar - mesmo espírito do
 * `CloseSemesterDialog` pessoal (Histórico). Disciplinas e publicações do
 * ciclo atual NÃO são apagadas: só saem da aba principal e passam a viver no
 * Histórico da turma.
 */
export function FinishSemesterDialog({ classId, open, onOpenChange }: FinishSemesterDialogProps) {
  const { data: preview, isLoading } = useFinishSemesterPreview(classId, open);
  const finishSemester = useFinishSemester();

  const handleConfirm = async (): Promise<void> => {
    await finishSemester.mutateAsync(classId);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar semestre?</AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isLoading || !preview ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 py-3 text-sm">
                    <span className="font-medium text-foreground">
                      {defaultSemesterName(preview.currentSemester)} · {preview.currentPeriod}º
                      período
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                    <span className="font-medium text-foreground">
                      {preview.nextSemester.name} · {preview.nextPeriod}º período
                    </span>
                  </div>

                  <p>
                    <strong className="text-foreground">
                      {preview.subjectCount}{' '}
                      {preview.subjectCount === 1 ? 'disciplina' : 'disciplinas'}
                    </strong>{' '}
                    e{' '}
                    <strong className="text-foreground">
                      {preview.postCount} {preview.postCount === 1 ? 'publicação' : 'publicações'}
                    </strong>{' '}
                    do ciclo atual passam a viver só na aba{' '}
                    <strong className="text-foreground">Histórico</strong> — nada é apagado.
                  </p>

                  <p className="text-xs text-muted-foreground">
                    O ciclo novo começa vazio. Isso não mexe nas notas de ninguém - encerrar o
                    semestre pessoal continua sendo uma decisão de cada membro, em Histórico.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button onClick={() => void handleConfirm()} disabled={finishSemester.isPending}>
            {finishSemester.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Finalizar semestre
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
