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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { DateTimePicker } from '@/components/ui/date-time-picker';
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

/** ISO -> "YYYY-MM-DDTHH:mm" em horario local, formato do `datetime-local`. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

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
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues, unknown, CreateExamInput>({
    resolver: zodResolver(createExamSchema),
    defaultValues: { title: '', subjectId: '', date: '', weight: 1 },
  });

  useEffect(() => {
    if (!open) return;

    if (exam) {
      reset({
        title: exam.title,
        subjectId: exam.subject.id,
        date: toLocalInputValue(exam.date),
        content: exam.content ?? '',
        notes: exam.notes ?? '',
        room: exam.room ?? '',
        weight: exam.weight,
        durationMinutes: exam.durationMinutes ?? undefined,
      });
    } else {
      reset({
        title: '',
        subjectId: defaultSubjectId ?? '',
        date: '',
        content: '',
        notes: '',
        room: '',
        weight: 1,
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
          <FormField label="Título" error={errors.title?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('title')}
                placeholder="P1 - Primeira avaliação"
                autoFocus
              />
            )}
          </FormField>

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
            <FormField label="Data e hora" error={errors.date?.message} required>
              {(field) => (
                <Controller
                  control={control}
                  name="date"
                  render={({ field: controlled }) => (
                    <DateTimePicker
                      {...field}
                      value={controlled.value ?? ''}
                      onChange={controlled.onChange}
                    />
                  )}
                />
              )}
            </FormField>

            <FormField label="Sala" error={errors.room?.message}>
              {(field) => <Input {...field} {...register('room')} placeholder="Sala 15" />}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <FormField
              label="Duração (min)"
              error={errors.durationMinutes?.message}
              hint="Opcional"
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('durationMinutes')}
                  type="number"
                  min={0}
                  placeholder="120"
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

          <FormField label="Observações" error={errors.notes?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('notes')}
                placeholder="Material permitido, formato da prova..."
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
              {isEditing ? 'Salvar' : 'Cadastrar prova'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
