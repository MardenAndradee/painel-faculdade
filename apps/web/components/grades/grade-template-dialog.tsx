'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  gradeConfigurationInputSchema,
  type GradeConfigurationFormValues,
  type GradeConfigurationInput,
} from '@painel/shared';
import {
  useReplaceSemesterGradeConfigurationTemplate,
  useReplaceUserDefaultGradeConfiguration,
  useSemesterGradeConfigurationTemplate,
  useUserDefaultGradeConfiguration,
} from '@/hooks/use-grade-configuration';
import { GradeTemplatePropagationDialog } from './grade-template-propagation-dialog';
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

export type GradeTemplateTarget =
  { type: 'semester'; semesterId: string; semesterName: string } | { type: 'default' };

interface GradeTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: GradeTemplateTarget;
}

const EMPTY_CONFIG = { passingGrade: 6, components: [] };

/**
 * Modelo de notas (Etapa 19): N1/N2/N3 e afins, mas como um MODELO - nunca
 * uma nota real. Serve só para pré-preencher a configuração de disciplinas
 * novas (a do usuário, usada quando um semestre não tem modelo próprio; ou a
 * de um semestre específico, que tem prioridade sobre a do usuário).
 *
 * Diferente de `GradeConfigurationDialog` (disciplina): aqui um componente
 * nunca tem nota lançada diretamente - só a CÓPIA dele, numa disciplina real,
 * pode ter - então não há botão de excluir bloqueado.
 */
export function GradeTemplateDialog({ open, onOpenChange, target }: GradeTemplateDialogProps) {
  const isSemester = target.type === 'semester';

  const semesterQuery = useSemesterGradeConfigurationTemplate(
    isSemester ? target.semesterId : '',
    open && isSemester,
  );
  const defaultQuery = useUserDefaultGradeConfiguration(open && !isSemester);

  const config = isSemester ? semesterQuery.data : defaultQuery.data;
  const isLoading = isSemester ? semesterQuery.isLoading : defaultQuery.isLoading;

  const replaceSemester = useReplaceSemesterGradeConfigurationTemplate();
  const replaceDefault = useReplaceUserDefaultGradeConfiguration();

  // Depois de salvar o modelo de um semestre, a oferta de propagar precisa
  // continuar visível mesmo com o formulário "fechado" - por isso é um passo
  // interno (`step`), não um `onOpenChange(false)` de verdade. Chamar o
  // `onOpenChange` do pai aqui desmontaria este componente inteiro (o pai só
  // renderiza `GradeTemplateDialog` enquanto o alvo não é nulo), levando
  // junto o diálogo de propagação que mora dentro dele.
  const [step, setStep] = useState<'form' | 'propagation'>('form');

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeConfigurationFormValues, unknown, GradeConfigurationInput>({
    resolver: zodResolver(gradeConfigurationInputSchema),
    defaultValues: EMPTY_CONFIG,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'components' });

  // Toda vez que o diálogo abre de novo, começa pelo formulário - nunca
  // reabre já no passo de propagação de uma sessão anterior.
  useEffect(() => {
    if (open) setStep('form');
  }, [open]);

  useEffect(() => {
    if (!open || isLoading) return;

    const source = config ?? EMPTY_CONFIG;

    reset({
      passingGrade: source.passingGrade,
      components: source.components.map((component) => ({
        id: component.id,
        name: component.name,
        weight: component.weight,
      })),
    });
  }, [open, isLoading, config, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isSemester) {
        await replaceSemester.mutateAsync({ semesterId: target.semesterId, data: values });

        // Salvar o modelo não mexe em disciplina nenhuma (Etapa 17). A oferta
        // de propagar vem logo depois, enquanto o que mudou ainda está fresco
        // na cabeça de quem mexeu - por isso troca de passo em vez de fechar
        // (`onOpenChange(false)` desmontaria o diálogo de propagação junto).
        setStep('propagation');
        return;
      }

      await replaceDefault.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook. O diálogo fica aberto para correção.
    }
  });

  return (
    <>
      <Dialog open={open && step === 'form'} onOpenChange={(next) => !next && onOpenChange(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isSemester ? 'Modelo de notas do semestre' : 'Notas padrão'}</DialogTitle>
            <DialogDescription>
              {isSemester
                ? `Componentes usados para pré-preencher disciplinas novas de ${target.semesterName}. Disciplinas já criadas não mudam.`
                : 'Modelo usado para pré-preencher disciplinas novas — inclusive as importadas do Classroom — quando o semestre não tem um modelo próprio.'}
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
                    Nenhum componente ainda. Adicione N1, N2, ou o que fizer sentido.
                  </p>
                )}

                {fields.map((field, index) => (
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
                      title="Remover"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}

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

      {isSemester && (
        <GradeTemplatePropagationDialog
          open={open && step === 'propagation'}
          onOpenChange={(next) => {
            // Fechar aqui é o fim de verdade do fluxo: agora sim avisa o pai.
            if (!next) onOpenChange(false);
          }}
          semesterId={target.semesterId}
          semesterName={target.semesterName}
        />
      )}
    </>
  );
}
