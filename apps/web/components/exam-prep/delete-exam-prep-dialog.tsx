'use client';

import { useRouter } from 'next/navigation';
import { useExamPrepDeletionPreview, useDeleteExamPrep } from '@/hooks/use-exam-preps';
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

interface DeleteExamPrepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examPrepId: string;
}

/**
 * Confirmação de exclusão do plano (Etapa 12) - nunca silenciosa quando há
 * flashcards em jogo (R1 do plano): mostra exatamente o que some antes de
 * apagar. Provas, disciplina, materiais originais e o tempo já contado nas
 * Estatísticas sobrevivem - só o que é exclusivo do plano vai junto.
 */
export function DeleteExamPrepDialog({
  open,
  onOpenChange,
  examPrepId,
}: DeleteExamPrepDialogProps) {
  const router = useRouter();
  const { data: preview, isLoading } = useExamPrepDeletionPreview(examPrepId, open);
  const deleteExamPrep = useDeleteExamPrep();

  const handleConfirm = (): void => {
    deleteExamPrep.mutate(examPrepId, {
      onSuccess: () => {
        onOpenChange(false);
        router.push('/provas');
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir plano de estudos?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {isLoading || !preview ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <p>A prova, a disciplina e os materiais vinculados não são afetados.</p>

                  {(preview.deckCount > 0 ||
                    preview.itemCount > 0 ||
                    preview.materialCount > 0) && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">
                      {preview.deckCount > 0 && (
                        <li>
                          {preview.deckCount === 1 ? '1 baralho' : `${preview.deckCount} baralhos`}
                          {preview.cardCount > 0 &&
                            ` (${preview.cardCount} ${preview.cardCount === 1 ? 'cartão' : 'cartões'})`}{' '}
                          criado{preview.deckCount === 1 ? '' : 's'} neste plano será
                          {preview.deckCount === 1 ? '' : 'ão'} excluído
                          {preview.deckCount === 1 ? '' : 's'}
                        </li>
                      )}
                      {preview.itemCount > 0 && (
                        <li>
                          {preview.itemCount === 1
                            ? '1 conteúdo/objetivo'
                            : `${preview.itemCount} conteúdos/objetivos`}{' '}
                          será{preview.itemCount === 1 ? '' : 'ão'} perdido
                          {preview.itemCount === 1 ? '' : 's'}
                        </li>
                      )}
                      {preview.materialCount > 0 && (
                        <li>
                          {preview.materialCount === 1
                            ? '1 referência de material'
                            : `${preview.materialCount} referências de material`}{' '}
                          será{preview.materialCount === 1 ? '' : 'ão'} desvinculada
                          {preview.materialCount === 1 ? '' : 's'} (os arquivos continuam existindo)
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteExamPrep.isPending}>
            Excluir plano
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
