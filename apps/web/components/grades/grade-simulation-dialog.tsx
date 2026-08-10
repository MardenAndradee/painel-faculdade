'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useSubjectGradeConfiguration } from '@/hooks/use-grade-configuration';
import { useSubjectGrades } from '@/hooks/use-grades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { calculateRequiredGrade, calculateWeightedAverage } from '@/lib/grade-math';
import { formatGrade } from '@/lib/format';
import { cn } from '@/lib/utils';

interface GradeSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
}

/**
 * Simulação de notas.
 *
 * Roda inteiramente no navegador - nada aqui é salvo. Carrega as notas reais
 * já lançadas como ponto de partida, mas qualquer campo (inclusive os já
 * lançados) pode ser editado livremente para explorar cenários. Se o usuário
 * quiser tornar um valor real, ele usa o formulário normal de lançar nota.
 */
export function GradeSimulationDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
}: GradeSimulationDialogProps) {
  const { data: config, isLoading: loadingConfig } = useSubjectGradeConfiguration(subjectId);
  const { data: summary, isLoading: loadingSummary } = useSubjectGrades(subjectId);

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !summary) return;

    const initial: Record<string, string> = {};

    for (const grade of summary.grades) {
      initial[grade.gradeComponent.id] = String(grade.value);
    }

    setValues(initial);
  }, [open, summary]);

  const result = useMemo(() => {
    const components = config?.components ?? [];
    const passingGrade = config?.passingGrade ?? 6;

    const filled = components
      .map((component) => ({ component, raw: values[component.id] }))
      .filter((item) => item.raw !== undefined && item.raw !== '')
      .map((item) => ({
        value: Number(item.raw),
        maxValue: 10,
        weight: item.component.weight,
      }))
      .filter((item) => !Number.isNaN(item.value));

    const pending = components.filter((component) => {
      const raw = values[component.id];
      return raw === undefined || raw === '';
    });

    const totalWeight = components.reduce((total, component) => total + component.weight, 0);
    const average = calculateWeightedAverage(filled, totalWeight);
    const remainingWeight = pending.reduce((total, component) => total + component.weight, 0);
    const requiredGrade =
      average !== null && remainingWeight > 0
        ? calculateRequiredGrade(filled, passingGrade, remainingWeight)
        : null;

    return { average, requiredGrade, pending, passingGrade };
  }, [config, values]);

  const isLoading = loadingConfig || loadingSummary;
  const isApproved = result.average !== null && result.average >= result.passingGrade;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" aria-hidden />
            Simular notas
          </DialogTitle>
          <DialogDescription>
            Explore cenários para {subjectName} — nada aqui é salvo automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (config?.components.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Esta disciplina ainda não tem componentes de avaliação configurados.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {config?.components.map((component) => (
                <div key={component.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{component.name}</p>
                    <p className="text-xs text-muted-foreground">peso {component.weight}</p>
                  </div>

                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step="0.01"
                    placeholder="—"
                    className="w-24"
                    value={values[component.id] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [component.id]: event.target.value }))
                    }
                    aria-label={`Nota simulada de ${component.name}`}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Média simulada</span>
                <span
                  className={cn(
                    'text-2xl font-semibold tabular-nums',
                    result.average === null
                      ? 'text-muted-foreground'
                      : isApproved
                        ? 'text-status-completed'
                        : 'text-status-overdue',
                  )}
                >
                  {formatGrade(result.average)}
                </span>
              </div>

              {result.pending.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.requiredGrade === null
                    ? `Preencha ao menos um componente para ver a projeção de ${result.pending.map((c) => c.name).join(', ')}.`
                    : result.requiredGrade <= 0
                      ? `Aprovação garantida, mesmo zerando ${result.pending.map((c) => c.name).join(', ')}.`
                      : result.requiredGrade > 10
                        ? 'Aprovação não é mais possível pela média.'
                        : `Precisa de ${formatGrade(result.requiredGrade)} em ${result.pending.map((c) => c.name).join(', ')} para aprovar.`}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
