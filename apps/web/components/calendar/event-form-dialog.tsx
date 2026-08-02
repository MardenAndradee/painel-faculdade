'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  createCalendarEventSchema,
  type CalendarEventFormValues,
  type CreateCalendarEventInput,
} from '@painel/shared';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/hooks/use-calendar';
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

/** Evento em edicao, no formato devolvido pela agenda. */
export interface EditingEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  subjectId: string | null;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EditingEvent | null;
  /** Data clicada na grade: pre-preenche o formulario. */
  defaultDate?: Date | null;
}

const NO_SUBJECT = '__none__';

function toLocalInputValue(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function EventFormDialog({ open, onOpenChange, event, defaultDate }: EventFormDialogProps) {
  const isEditing = Boolean(event);
  const { data: subjectsData } = useSubjects({ perPage: 100, status: 'IN_PROGRESS' });
  const subjects = subjectsData?.data ?? [];

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CalendarEventFormValues, unknown, CreateCalendarEventInput>({
    resolver: zodResolver(createCalendarEventSchema),
    defaultValues: { title: '', startsAt: '', endsAt: '' },
  });

  useEffect(() => {
    if (!open) return;

    if (event) {
      reset({
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        startsAt: toLocalInputValue(event.startsAt),
        endsAt: toLocalInputValue(event.endsAt),
        allDay: event.allDay,
        subjectId: event.subjectId,
      });
    } else {
      // Ao criar a partir de um dia da grade, sugere 09:00-10:00 nesse dia.
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setHours(9, 0, 0, 0);
      const end = new Date(base.getTime() + 60 * 60 * 1000);

      reset({
        title: '',
        description: '',
        location: '',
        startsAt: toLocalInputValue(base),
        endsAt: toLocalInputValue(end),
        allDay: false,
        subjectId: null,
      });
    }
  }, [open, event, defaultDate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({ id: event.id, data: values });
      } else {
        await createEvent.mutateAsync(values);
      }

      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o dialogo fica aberto para correcao.
    }
  });

  const handleDelete = async (): Promise<void> => {
    if (!event) return;

    await deleteEvent.mutateAsync(event.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do evento.'
              : 'Crie um compromisso próprio na sua agenda.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event_) => void onSubmit(event_)} className="space-y-4" noValidate>
          <FormField label="Título" error={errors.title?.message} required>
            {(field) => (
              <Input {...field} {...register('title')} placeholder="Reunião do grupo" autoFocus />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Início" error={errors.startsAt?.message} required>
              {(field) => <Input {...field} {...register('startsAt')} type="datetime-local" />}
            </FormField>

            <FormField label="Término" error={errors.endsAt?.message} required>
              {(field) => <Input {...field} {...register('endsAt')} type="datetime-local" />}
            </FormField>
          </div>

          <FormField label="Dia inteiro" error={errors.allDay?.message}>
            {(field) => (
              <Controller
                control={control}
                name="allDay"
                render={({ field: controlled }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      id={field.id}
                      type="checkbox"
                      checked={controlled.value === true}
                      onChange={(changeEvent) => controlled.onChange(changeEvent.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="text-muted-foreground">Ocupa o dia todo</span>
                  </label>
                )}
              />
            )}
          </FormField>

          <FormField label="Local" error={errors.location?.message}>
            {(field) => (
              <Input {...field} {...register('location')} placeholder="Biblioteca, sala 3" />
            )}
          </FormField>

          <FormField label="Disciplina" error={errors.subjectId?.message} hint="Opcional">
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

          <FormField label="Descrição" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                placeholder="Detalhes do compromisso"
                rows={2}
              />
            )}
          </FormField>

          <DialogFooter className="sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => void handleDelete()}
                disabled={deleteEvent.isPending}
              >
                <Trash2 className="size-4" aria-hidden />
                Excluir
              </Button>
            ) : (
              <span />
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  !isEditing && <Plus className="size-4" aria-hidden />
                )}
                {isEditing ? 'Salvar' : 'Criar evento'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
