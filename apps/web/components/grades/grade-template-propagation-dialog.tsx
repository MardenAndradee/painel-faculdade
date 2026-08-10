'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { GradeTemplateChange } from '@painel/shared';
import {
  useGradeTemplatePropagationPreview,
  usePropagateGradeTemplate,
} from '@/hooks/use-grade-configuration';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GradeTemplatePropagationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterName: string;
}

/** Descreve uma mudanca em uma linha, do jeito que se leria em voz alta. */
function describeChange(change: GradeTemplateChange): string {
  switch (change.kind) {
    case 'ADD_COMPONENT':
      return `adiciona ${change.componentName ?? 'componente'} com peso ${change.to}`;

    case 'UPDATE_WEIGHT':
      return `${change.componentName ?? 'componente'}: peso ${change.from} → ${change.to}`;

    case 'UPDATE_PASSING_GRADE':
      return `nota para aprovação: ${change.from} → ${change.to}`;
  }
}

/**
 * Confirmacao da propagacao do modelo do semestre (Etapa 18).
 *
 * A Etapa 17 decidiu que configuracao de nota e copiada, nunca compartilhada -
 * e essa garantia continua: nenhuma disciplina muda sem passar por aqui. Este
 * dialogo existe para que a escolha seja informada, nao automatica; por isso
 * mostra o que muda em cada disciplina e destaca quando o peso alterado tem
 * nota lancada, porque ai a media que a pessoa ja viu na tela muda de verdade.
 *
 * As disciplinas vem marcadas por padrao: quem abriu o modelo e mexeu nele
 * normalmente quer aquilo valendo no periodo inteiro.
 */
export function GradeTemplatePropagationDialog({
  open,
  onOpenChange,
  semesterId,
  semesterName,
}: GradeTemplatePropagationDialogProps) {
  const { data, isLoading } = useGradeTemplatePropagationPreview(semesterId, open);
  const propagate = usePropagateGradeTemplate();

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !data) return;

    setSelected(data.subjects.map((subject) => subject.subjectId));
  }, [open, data]);

  const subjects = data?.subjects ?? [];

  const toggle = (subjectId: string): void => {
    setSelected((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
  };

  const handleConfirm = async (): Promise<void> => {
    try {
      await propagate.mutateAsync({ semesterId, subjectIds: selected });
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar o modelo nas disciplinas de {semesterName}?</DialogTitle>
          <DialogDescription>
            Editar o modelo não muda disciplinas já criadas. Marque as que devem receber as mudanças
            — componentes que só a disciplina tem são preservados.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            As disciplinas de {semesterName} já estão alinhadas com o modelo.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {subjects.map((subject) => {
              const isSelected = selected.includes(subject.subjectId);
              const touchesGrades = subject.changes.some((change) => change.affectsGrades);

              return (
                <li key={subject.subjectId}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(subject.subjectId)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: subject.subjectColor }}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-medium">{subject.subjectName}</span>
                      </div>

                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {subject.changes.map((change, index) => (
                          <li key={index}>{describeChange(change)}</li>
                        ))}
                      </ul>

                      {touchesGrades && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-status-pending">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          Já tem nota lançada — a média será recalculada.
                        </p>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {subjects.length === 0 ? 'Fechar' : 'Agora não'}
          </Button>

          {subjects.length > 0 && (
            <Button
              type="button"
              disabled={selected.length === 0 || propagate.isPending}
              onClick={() => void handleConfirm()}
            >
              {propagate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Aplicar em {selected.length} {selected.length === 1 ? 'disciplina' : 'disciplinas'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
