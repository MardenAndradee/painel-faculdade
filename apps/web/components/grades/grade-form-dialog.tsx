'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createGradeSchema,
  type CreateGradeInput,
  type GradeFormValues,
  type GradeListItem,
} from '@painel/shared';
import { useCreateGrade, useUpdateGrade } from '@/hooks/use-grades';
import { useSubjectGradeConfiguration } from '@/hooks/use-grade-configuration';
import { useSubjects } from '@/hooks/use-subjects';
import { useExams } from '@/hooks/use-exams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { DatePicker } from '@/components/ui/date-picker';
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

interface GradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grade?: GradeListItem | null;
  /** Pré-seleciona a disciplina quando aberto pela tela dela. */
  defaultSubjectId?: string | null;
}

const NO_EXAM = '__none__';

export function GradeFormDialog({
  open,
  onOpenChange,
  grade,
  defaultSubjectId,
}: GradeFormDialogProps) {
  const isEditing = Boolean(grade);
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues, unknown, CreateGradeInput>({
    resolver: zodResolver(createGradeSchema),
    defaultValues: { subjectId: '', gradeComponentId: '', value: 0, maxValue: 10, isFinal: true },
  });

  // Os componentes e as provas oferecidos dependem da disciplina escolhida.
  const selectedSubjectId = watch('subjectId');
  const { data: config } = useSubjectGradeConfiguration(selectedSubjectId || '');
  const { data: examsData } = useExams({
    subjectId: selectedSubjectId || undefined,
    view: 'todas',
    perPage: 100,
  });

  /**
   * Provas disponíveis para vínculo.
   *
   * Só as sem nota, mais a que já está vinculada nesta nota (na edição) —
   * do contrário ela sumiria da lista ao reabrir o formulário.
   */
  const availableExams = (examsData?.data ?? []).filter(
    (exam) => exam.grade === null || exam.id === grade?.exam?.id,
  );

  useEffect(() => {
    if (!open) return;

    if (grade) {
      reset({
        subjectId: grade.subject.id,
        gradeComponentId: grade.gradeComponent.id,
        label: grade.label ?? '',
        value: grade.value,
        maxValue: grade.maxValue,
        examId: grade.exam?.id ?? null,
        gradedAt: grade.gradedAt.slice(0, 10),
        notes: grade.notes ?? '',
        isFinal: grade.isFinal,
      });
    } else {
      reset({
        subjectId: defaultSubjectId ?? '',
        gradeComponentId: '',
        label: '',
        value: 0,
        maxValue: 10,
        examId: null,
        gradedAt: new Date().toISOString().slice(0, 10),
        notes: '',
        isFinal: true,
      });
    }
  }, [open, grade, defaultSubjectId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && grade) {
        await updateGrade.mutateAsync({ id: grade.id, data: values });
      } else {
        await createGrade.mutateAsync(values);
      }

      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar nota' : 'Lançar nota'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da avaliação.'
              : 'Registre uma nota para acompanhar sua média.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Disciplina" error={errors.subjectId?.message} required>
            {(field) => (
              <Controller
                control={control}
                name="subjectId"
                render={({ field: controlled }) => (
                  <Select value={controlled.value || undefined} onValueChange={controlled.onChange}>
                    <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                      <SelectValue placeholder="Selecione a disciplina" />
                    </SelectTrigger>

                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Componente"
              error={errors.gradeComponentId?.message}
              hint={
                selectedSubjectId && config?.components.length === 0
                  ? 'Configure os componentes de notas da disciplina primeiro'
                  : undefined
              }
              required
            >
              {(field) => (
                <Controller
                  control={control}
                  name="gradeComponentId"
                  render={({ field: controlled }) => (
                    <Select
                      value={controlled.value || undefined}
                      onValueChange={controlled.onChange}
                      disabled={!selectedSubjectId || (config?.components.length ?? 0) === 0}
                    >
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>

                      <SelectContent>
                        {config?.components.map((component) => (
                          <SelectItem key={component.id} value={component.id}>
                            {component.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>

            <FormField label="Descrição" error={errors.label?.message} hint="Opcional, ex: Lista 3">
              {(field) => <Input {...field} {...register('label')} placeholder="Lista 3" />}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nota" error={errors.value?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('value')}
                  type="number"
                  min={0}
                  step="0.01"
                  autoFocus
                />
              )}
            </FormField>

            <FormField label="Escala" error={errors.maxValue?.message} hint="Nota máxima">
              {(field) => (
                <Input {...field} {...register('maxValue')} type="number" min={1} step="1" />
              )}
            </FormField>
          </div>

          <FormField
            label="Situação"
            error={errors.isFinal?.message}
            hint="Marque quando o professor ainda vai lançar mais pontos neste componente"
          >
            {() => (
              <Controller
                control={control}
                name="isFinal"
                render={({ field: controlled }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={controlled.value === false}
                      onChange={(event) => controlled.onChange(!event.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="text-muted-foreground">
                      Ainda não é a nota final (mais pontos vão somar depois)
                    </span>
                  </label>
                )}
              />
            )}
          </FormField>

          {/* Vínculo com prova: só faz sentido se a disciplina tiver provas. */}
          {availableExams.length > 0 && (
            <FormField
              label="Prova correspondente"
              error={errors.examId?.message}
              hint="Vincula a nota a uma prova cadastrada"
            >
              {(field) => (
                <Controller
                  control={control}
                  name="examId"
                  render={({ field: controlled }) => (
                    <Select
                      value={controlled.value ?? NO_EXAM}
                      onValueChange={(value) =>
                        controlled.onChange(value === NO_EXAM ? null : value)
                      }
                    >
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NO_EXAM}>Nenhuma</SelectItem>
                        {availableExams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.subject.name} · {formatDate(exam.date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data" error={errors.gradedAt?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="gradedAt"
                  render={({ field: controlled }) => (
                    <DatePicker
                      {...field}
                      value={controlled.value ?? ''}
                      onChange={controlled.onChange}
                    />
                  )}
                />
              )}
            </FormField>
          </div>

          <FormField label="Observações" error={errors.notes?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('notes')}
                placeholder="Comentários do professor, pontos a revisar..."
                rows={2}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                !isEditing && <Plus className="size-4" aria-hidden />
              )}
              {isEditing ? 'Salvar' : 'Lançar nota'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
