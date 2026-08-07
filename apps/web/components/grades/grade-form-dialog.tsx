'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createGradeSchema,
  GRADE_TYPE,
  GRADE_TYPE_LABELS,
  type CreateGradeInput,
  type GradeFormValues,
  type GradeListItem,
} from '@painel/shared';
import { useCreateGrade, useSubjectGrades, useUpdateGrade } from '@/hooks/use-grades';
import { useSubjects } from '@/hooks/use-subjects';
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
    defaultValues: { subjectId: '', type: 'OTHER', value: 0, maxValue: 10, weight: 1 },
  });

  // As provas oferecidas dependem da disciplina escolhida no momento.
  const selectedSubjectId = watch('subjectId');
  const { data: summary } = useSubjectGrades(selectedSubjectId || '');

  /**
   * Provas disponíveis para vínculo.
   *
   * Só as sem nota, mais a que já está vinculada nesta nota (na edição) —
   * do contrário ela sumiria da lista ao reabrir o formulário.
   */
  const availableExams = [
    ...(summary?.pendingExams ?? []),
    ...(grade?.exam ? [{ ...grade.exam, weight: 0 }] : []),
  ];

  useEffect(() => {
    if (!open) return;

    if (grade) {
      reset({
        subjectId: grade.subject.id,
        type: grade.type,
        label: grade.label ?? '',
        value: grade.value,
        maxValue: grade.maxValue,
        weight: grade.weight,
        examId: grade.exam?.id ?? null,
        gradedAt: grade.gradedAt.slice(0, 10),
        notes: grade.notes ?? '',
      });
    } else {
      reset({
        subjectId: defaultSubjectId ?? '',
        type: 'OTHER',
        label: '',
        value: 0,
        maxValue: 10,
        weight: 1,
        examId: null,
        gradedAt: new Date().toISOString().slice(0, 10),
        notes: '',
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
            <FormField label="Tipo" error={errors.type?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="type"
                  render={({ field: controlled }) => (
                    <Select value={controlled.value} onValueChange={controlled.onChange}>
                      <SelectTrigger id={field.id}>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {GRADE_TYPE.map((type) => (
                          <SelectItem key={type} value={type}>
                            {GRADE_TYPE_LABELS[type]}
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

          <div className="grid gap-4 sm:grid-cols-3">
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

            <FormField label="Peso" error={errors.weight?.message} hint="Na média">
              {(field) => (
                <Input {...field} {...register('weight')} type="number" min={0} step="0.5" />
              )}
            </FormField>
          </div>

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
                            {exam.title} · {formatDate(exam.date)}
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
