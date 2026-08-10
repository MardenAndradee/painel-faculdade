'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { GradeListItem } from '@painel/shared';
import { useSubjectGradeConfiguration } from '@/hooks/use-grade-configuration';
import { useCreateGrade, useSubjectGrades, useUpdateGrade } from '@/hooks/use-grades';
import { useExams } from '@/hooks/use-exams';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/format';

interface GradeQuickEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
}

const NO_EXAM = '__none__';

/**
 * Lançamento rápido de notas.
 *
 * Diferente de `GradeFormDialog` (genérico, escolhe disciplina/escala/prazo):
 * aqui a disciplina já é a do card clicado, a escala é sempre 10 e a data é
 * sempre hoje - um campo por componente configurado, pronto para digitar e
 * salvar. O formulário completo continua existindo para quem clica em
 * "Lançar nota" ou edita uma nota específica.
 *
 * Um componente que já tem nota FINAL fica travado aqui - editar um valor
 * fechado é ação deliberada, não rápida (usa o formulário completo). Um
 * componente "em aberto" (nota parcial, Etapa 18) fica editável: digitar um
 * valor novo atualiza essa mesma nota, em vez de criar uma segunda.
 *
 * Vínculo com prova: só faz sentido quando exatamente um componente está
 * sendo lançado - duas notas não podem apontar para a mesma prova.
 */
export function GradeQuickEntryDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
}: GradeQuickEntryDialogProps) {
  const { data: config, isLoading: loadingConfig } = useSubjectGradeConfiguration(subjectId);
  const { data: summary, isLoading: loadingSummary } = useSubjectGrades(subjectId);
  const { data: examsData } = useExams({ subjectId, view: 'todas', perPage: 100 });

  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();

  const [values, setValues] = useState<Record<string, string>>({});
  const [examId, setExamId] = useState<string | null>(null);
  const [notFinal, setNotFinal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setValues({});
    setExamId(null);
    setNotFinal(false);
  }, [open, subjectId]);

  /** Nota já lançada de cada componente, quando houver (a mais recente). */
  const gradeByComponent = useMemo(() => {
    const map = new Map<string, GradeListItem>();

    for (const grade of summary?.grades ?? []) {
      if (!map.has(grade.gradeComponent.id)) map.set(grade.gradeComponent.id, grade);
    }

    return map;
  }, [summary]);

  const components = config?.components ?? [];

  const filledComponentIds = components
    .filter((component) => !gradeByComponent.get(component.id)?.isFinal)
    .filter((component) => (values[component.id] ?? '').trim() !== '');

  // Duas notas nao podem apontar pra mesma prova - o seletor so aparece
  // quando exatamente uma esta sendo lancada.
  const canLinkExam = filledComponentIds.length === 1;

  useEffect(() => {
    if (!canLinkExam) setExamId(null);
  }, [canLinkExam]);

  const availableExams = (examsData?.data ?? []).filter((exam) => exam.grade === null);

  const isLoading = loadingConfig || loadingSummary;

  const onSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    try {
      const jobs = components.flatMap((component) => {
        const existing = gradeByComponent.get(component.id);

        if (existing?.isFinal) return [];

        const raw = (values[component.id] ?? '').trim();
        if (raw === '') return [];

        const value = Number(raw);
        if (Number.isNaN(value)) return [];

        const effectiveExamId = canLinkExam ? examId : null;

        if (existing) {
          return [
            updateGrade.mutateAsync({
              id: existing.id,
              data: { value, isFinal: !notFinal, examId: effectiveExamId },
            }),
          ];
        }

        return [
          createGrade.mutateAsync({
            subjectId,
            gradeComponentId: component.id,
            value,
            maxValue: 10,
            gradedAt: undefined,
            isFinal: !notFinal,
            examId: effectiveExamId,
          }),
        ];
      });

      if (jobs.length > 0) await Promise.all(jobs);

      onOpenChange(false);
    } catch {
      // O toast de erro vem de cada mutação; o diálogo fica aberto.
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyEditable = components.some(
    (component) => !gradeByComponent.get(component.id)?.isFinal,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4" aria-hidden />
            Lançamento rápido
          </DialogTitle>
          <DialogDescription>{subjectName} · nota de hoje, escala 0 a 10.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : components.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Esta disciplina ainda não tem componentes de avaliação configurados.
          </p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
            <div className="space-y-2">
              {components.map((component) => {
                const existing = gradeByComponent.get(component.id);
                const locked = existing?.isFinal ?? false;

                return (
                  <div key={component.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{component.name}</p>
                      <p className="text-xs text-muted-foreground">
                        peso {component.weight}
                        {locked && ' · nota final já lançada'}
                        {!locked && existing && ' · em aberto, digite para atualizar'}
                      </p>
                    </div>

                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step="0.01"
                      className="w-24"
                      placeholder={locked ? undefined : '—'}
                      disabled={locked}
                      value={locked ? String(existing!.value) : (values[component.id] ?? '')}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [component.id]: event.target.value }))
                      }
                      aria-label={`Nota de ${component.name}`}
                    />
                  </div>
                );
              })}
            </div>

            {canLinkExam && availableExams.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prova correspondente</label>
                <Select
                  value={examId ?? NO_EXAM}
                  onValueChange={(value) => setExamId(value === NO_EXAM ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NO_EXAM}>Nenhuma</SelectItem>
                    {availableExams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.gradeComponent?.name ?? exam.title} · {formatDate(exam.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filledComponentIds.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Vínculo com prova disponível só ao lançar um componente por vez.
              </p>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notFinal}
                onChange={(event) => setNotFinal(event.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <span className="text-muted-foreground">
                Ainda não é a nota final (mais pontos vão somar depois)
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button type="submit" disabled={submitting || !hasAnyEditable}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
