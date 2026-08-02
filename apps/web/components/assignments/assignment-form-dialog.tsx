'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_STATUS_LABELS,
  createAssignmentSchema,
  PRIORITY,
  PRIORITY_LABELS,
  type AssignmentFormValues,
  type AssignmentListItem,
  type CreateAssignmentInput,
} from '@painel/shared';
import { useCreateAssignment, useUpdateAssignment } from '@/hooks/use-assignments';
import { useSubjects } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
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

interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: AssignmentListItem | null;
  /** Pre-seleciona a disciplina ao criar a partir da tela dela. */
  defaultSubjectId?: string | null;
}

const NO_SUBJECT = '__none__';

/**
 * Converte ISO para o formato do input `datetime-local`.
 *
 * O input exige "YYYY-MM-DDTHH:mm" em horario LOCAL - passar o ISO em UTC
 * exibiria o prazo deslocado pelo fuso.
 */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  defaultSubjectId,
}: AssignmentFormDialogProps) {
  const isEditing = Boolean(assignment);
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues, unknown, CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: { title: '', priority: 'MEDIUM', status: 'PENDING' },
  });

  useEffect(() => {
    if (!open) return;

    if (assignment) {
      reset({
        title: assignment.title,
        description: assignment.description ?? '',
        notes: assignment.notes ?? '',
        subjectId: assignment.subject?.id ?? null,
        dueDate: toLocalInputValue(assignment.dueDate),
        priority: assignment.priority,
        status: assignment.status,
        maxPoints: assignment.maxPoints ?? undefined,
      });
    } else {
      reset({
        title: '',
        description: '',
        notes: '',
        subjectId: defaultSubjectId ?? null,
        dueDate: '',
        priority: 'MEDIUM',
        status: 'PENDING',
      });
    }
  }, [open, assignment, defaultSubjectId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && assignment) {
        await updateAssignment.mutateAsync({ id: assignment.id, data: values });
      } else {
        await createAssignment.mutateAsync(values);
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
          <DialogTitle>{isEditing ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da atividade.'
              : 'Cadastre uma atividade e acompanhe o prazo no dashboard.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Título" error={errors.title?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('title')}
                placeholder="Lista de exercícios 3"
                autoFocus
              />
            )}
          </FormField>

          <FormField label="Disciplina" error={errors.subjectId?.message}>
            {(field) => (
              <Controller
                control={control}
                name="subjectId"
                render={({ field: controlled }) => (
                  <Select
                    value={controlled.value ?? NO_SUBJECT}
                    onValueChange={(value) =>
                      controlled.onChange(value === NO_SUBJECT ? null : value)
                    }
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={NO_SUBJECT}>Sem disciplina</SelectItem>
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
              label="Prazo"
              error={errors.dueDate?.message}
              hint="Deixe vazio se não houver"
            >
              {(field) => <Input {...field} {...register('dueDate')} type="datetime-local" />}
            </FormField>

            <FormField label="Prioridade" error={errors.priority?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="priority"
                  render={({ field: controlled }) => (
                    <Select value={controlled.value} onValueChange={controlled.onChange}>
                      <SelectTrigger id={field.id}>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {PRIORITY.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {PRIORITY_LABELS[priority]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Situação" error={errors.status?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="status"
                  render={({ field: controlled }) => (
                    <Select value={controlled.value} onValueChange={controlled.onChange}>
                      <SelectTrigger id={field.id}>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {ASSIGNMENT_STATUS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ASSIGNMENT_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>

            <FormField label="Pontuação máxima" error={errors.maxPoints?.message} hint="Opcional">
              {(field) => (
                <Input
                  {...field}
                  {...register('maxPoints')}
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="10"
                />
              )}
            </FormField>
          </div>

          <FormField label="Descrição" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                placeholder="O que precisa ser feito"
                rows={3}
              />
            )}
          </FormField>

          <FormField label="Observações" error={errors.notes?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('notes')}
                placeholder="Anotações pessoais, dúvidas, links"
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
              {isEditing ? 'Salvar' : 'Criar atividade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
