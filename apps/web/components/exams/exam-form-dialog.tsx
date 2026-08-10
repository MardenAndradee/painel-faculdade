'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createExamSchema,
  type CreateExamInput,
  type ExamFormValues,
  type ExamListItem,
} from '@painel/shared';
import { useCreateExam, useUpdateExam } from '@/hooks/use-exams';
import { useSubjects } from '@/hooks/use-subjects';
import { useSubjectGradeConfiguration } from '@/hooks/use-grade-configuration';
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

interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam?: ExamListItem | null;
  defaultSubjectId?: string | null;
}

const NO_COMPONENT = '__none__';

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  defaultSubjectId,
}: ExamFormDialogProps) {
  const isEditing = Boolean(exam);
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const createExam = useCreateExam();
  const updateExam = useUpdateExam();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues, unknown, CreateExamInput>({
    resolver: zodResolver(createExamSchema),
    defaultValues: { subjectId: '', date: '', weight: 1 },
  });

  // Os componentes de nota oferecidos dependem da disciplina escolhida.
  const selectedSubjectId = watch('subjectId');
  const { data: config } = useSubjectGradeConfiguration(selectedSubjectId || '');
  const hasComponents = (config?.components.length ?? 0) > 0;

  useEffect(() => {
    if (!open) return;

    if (exam) {
      reset({
        subjectId: exam.subject.id,
        date: exam.date.slice(0, 10),
        content: exam.content ?? '',
        weight: exam.weight,
        gradeComponentId: exam.gradeComponent?.id ?? null,
        gradeValue: exam.grade?.value ?? null,
      });
    } else {
      reset({
        subjectId: defaultSubjectId ?? '',
        date: '',
        content: '',
        weight: 1,
        gradeComponentId: null,
        gradeValue: null,
      });
    }
  }, [open, exam, defaultSubjectId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && exam) {
        await updateExam.mutateAsync({ id: exam.id, data: values });
      } else {
        await createExam.mutateAsync(values);
      }

      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o dialogo fica aberto para correcao.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar prova' : 'Nova prova'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da prova.'
              : 'Cadastre a prova para acompanhar a contagem regressiva.'}
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
            <FormField label="Data" error={errors.date?.message} required>
              {(field) => (
                <Controller
                  control={control}
                  name="date"
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

            <FormField
              label="Peso"
              error={errors.weight?.message}
              hint="Usado no cálculo da média"
              required
            >
              {(field) => (
                <Input {...field} {...register('weight')} type="number" min={0} step="0.5" />
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Componente de nota"
              error={errors.gradeComponentId?.message}
              hint={
                selectedSubjectId && !hasComponents
                  ? 'Configure os componentes de notas da disciplina primeiro'
                  : 'Opcional'
              }
            >
              {(field) => (
                <Controller
                  control={control}
                  name="gradeComponentId"
                  render={({ field: controlled }) => (
                    <Select
                      value={controlled.value ?? NO_COMPONENT}
                      onValueChange={(value) =>
                        controlled.onChange(value === NO_COMPONENT ? null : value)
                      }
                      disabled={!hasComponents}
                    >
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NO_COMPONENT}>Nenhum</SelectItem>
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

            <FormField
              label="Nota"
              error={errors.gradeValue?.message}
              hint="Lança em Notas automaticamente"
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('gradeValue')}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0 a 10"
                />
              )}
            </FormField>
          </div>

          <FormField label="Conteúdo" error={errors.content?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('content')}
                placeholder="Assuntos que caem na prova"
                rows={3}
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
              {isEditing ? 'Salvar' : 'Cadastrar prova'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
