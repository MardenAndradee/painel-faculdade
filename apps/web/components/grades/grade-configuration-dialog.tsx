'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  gradeConfigurationInputSchema,
  type GradeConfigurationFormValues,
  type GradeConfigurationInput,
} from '@painel/shared';
import {
  useReplaceSubjectGradeConfiguration,
  useSubjectGradeConfiguration,
} from '@/hooks/use-grade-configuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GradeConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
}

/**
 * Configuracao de notas da disciplina.
 *
 * O sistema nao sabe que existem "N1/N2/N3" - o usuario define aqui quais
 * componentes de avaliacao existem, o peso de cada um e a nota de aprovacao.
 * Um componente com nota ja lancada nao pode ser removido (o botao fica
 * desabilitado); a API bloquearia mesmo assim, mas evitar a tentativa e
 * melhor do que deixar o erro acontecer.
 */
export function GradeConfigurationDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
}: GradeConfigurationDialogProps) {
  const { data: config, isLoading } = useSubjectGradeConfiguration(subjectId);
  const replaceConfig = useReplaceSubjectGradeConfiguration();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeConfigurationFormValues, unknown, GradeConfigurationInput>({
    resolver: zodResolver(gradeConfigurationInputSchema),
    defaultValues: { passingGrade: 6, components: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'components' });

  useEffect(() => {
    if (!open || !config) return;

    reset({
      passingGrade: config.passingGrade,
      components: config.components.map((component) => ({
        id: component.id,
        name: component.name,
        weight: component.weight,
      })),
    });
  }, [open, config, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await replaceConfig.mutateAsync({ subjectId, data: values });
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook - inclusive o de "componente com nota
      // lançada", quando o backend recusa a remoção. O diálogo fica aberto.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar notas</DialogTitle>
          <DialogDescription>
            Componentes de avaliação e nota de aprovação de {subjectName}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
            <FormField
              label="Nota para aprovação"
              error={errors.passingGrade?.message}
              hint="Escala 0 a 10"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('passingGrade')}
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  className="max-w-32"
                />
              )}
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Componentes de avaliação</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', weight: 1 })}
                >
                  <Plus className="size-4" aria-hidden />
                  Adicionar
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nenhum componente ainda. Adicione N1, N2, ou o que fizer sentido para esta
                  disciplina.
                </p>
              )}

              {fields.map((field, index) => {
                const hasGrade = config?.components.find(
                  (component) => component.id === field.id,
                )?.hasGrade;

                return (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        {...register(`components.${index}.name`)}
                        placeholder="N1"
                        aria-label={`Nome do componente ${index + 1}`}
                      />
                      {errors.components?.[index]?.name && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.components[index]?.name?.message}
                        </p>
                      )}
                    </div>

                    <div className="w-24">
                      <Input
                        {...register(`components.${index}.weight`)}
                        type="number"
                        min={0}
                        step="0.5"
                        placeholder="Peso"
                        aria-label={`Peso do componente ${index + 1}`}
                      />
                      {errors.components?.[index]?.weight && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.components[index]?.weight?.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      disabled={hasGrade}
                      title={hasGrade ? 'Já tem nota lançada — exclua a nota antes' : 'Remover'}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                );
              })}

              {errors.components?.message && (
                <p className="text-xs text-destructive">{errors.components.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
