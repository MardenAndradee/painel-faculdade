'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, ClipboardList, ListChecks, Loader2, Plus } from 'lucide-react';
import {
  createClassPostSchema,
  PRIORITY,
  PRIORITY_LABELS,
  type ClassPostFormValues,
  type ClassPostKind,
  type ClassSubjectItem,
  type CreateClassPostInput,
} from '@painel/shared';
import { usePublishClassPost } from '@/hooks/use-class-posts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface ClassPostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  subjects: ClassSubjectItem[];
}

const NO_SUBJECT = '__none__';

/**
 * Um valor padrão por `kind`, no formato exato que aquele branco da união
 * discriminada exige - trocar de aba troca o formulário inteiro via `reset`,
 * não só os campos visíveis.
 */
const DEFAULTS: Record<ClassPostKind, ClassPostFormValues> = {
  ASSIGNMENT: {
    kind: 'ASSIGNMENT',
    title: '',
    description: '',
    classSubjectId: null,
    dueDate: null,
    priority: 'MEDIUM',
    maxPoints: undefined,
  },
  EXAM: {
    kind: 'EXAM',
    title: '',
    description: '',
    classSubjectId: '',
    date: '',
    durationMinutes: undefined,
    room: '',
  },
  EVENT: {
    kind: 'EVENT',
    title: '',
    description: '',
    classSubjectId: null,
    startsAt: '',
    endsAt: '',
    allDay: false,
  },
};

/**
 * Formulário de publicação (Etapa 21).
 *
 * `kind` é um campo comum aos três ramos da união discriminada - o mesmo
 * `zodResolver(createClassPostSchema)` funciona para os três, porque o
 * schema decide as regras a aplicar a partir do valor atual de `kind`.
 */
export function ClassPostFormDialog({
  open,
  onOpenChange,
  classId,
  subjects,
}: ClassPostFormDialogProps) {
  const publish = usePublishClassPost(classId);
  const [kind, setKind] = useState<ClassPostKind>('ASSIGNMENT');

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassPostFormValues, unknown, CreateClassPostInput>({
    resolver: zodResolver(createClassPostSchema),
    defaultValues: DEFAULTS.ASSIGNMENT,
  });

  useEffect(() => {
    if (open) {
      setKind('ASSIGNMENT');
      reset(DEFAULTS.ASSIGNMENT);
    }
  }, [open, reset]);

  const handleKindChange = (next: string): void => {
    const nextKind = next as ClassPostKind;

    setKind(nextKind);
    reset(DEFAULTS[nextKind]);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await publish.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  });

  // `errors` é tipado pelo output da união inteira - o cast por ramo evita
  // que o TS exija checar `kind` antes de cada leitura de campo especifico.
  const assignmentErrors = errors as {
    dueDate?: { message?: string };
    maxPoints?: { message?: string };
  };
  const examErrors = errors as {
    classSubjectId?: { message?: string };
    date?: { message?: string };
    durationMinutes?: { message?: string };
    room?: { message?: string };
  };
  const eventErrors = errors as {
    startsAt?: { message?: string };
    endsAt?: { message?: string };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar na turma</DialogTitle>
          <DialogDescription>
            Cria uma cópia pessoal para cada membro ativo, com o selo &quot;Da turma&quot;.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={handleKindChange}>
          <TabsList>
            <TabsTrigger value="ASSIGNMENT">
              <ListChecks aria-hidden />
              Atividade
            </TabsTrigger>
            <TabsTrigger value="EXAM">
              <ClipboardList aria-hidden />
              Prova
            </TabsTrigger>
            <TabsTrigger value="EVENT">
              <CalendarDays aria-hidden />
              Evento
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form
          onSubmit={(event) => void onSubmit(event)}
          className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
          noValidate
        >
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

          <FormField
            label="Disciplina"
            error={examErrors.classSubjectId?.message}
            required={kind === 'EXAM'}
          >
            {(field) => (
              <Controller
                control={control}
                name="classSubjectId"
                render={({ field: controlled }) => (
                  <Select
                    value={controlled.value ?? NO_SUBJECT}
                    onValueChange={(value) =>
                      controlled.onChange(
                        value === NO_SUBJECT ? (kind === 'EXAM' ? '' : null) : value,
                      )
                    }
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {kind !== 'EXAM' && (
                        <SelectItem value={NO_SUBJECT}>Sem disciplina</SelectItem>
                      )}
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

          {kind === 'EXAM' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Data" error={examErrors.date?.message} required>
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

              <FormField label="Duração (min)" error={examErrors.durationMinutes?.message}>
                {(field) => (
                  <Input {...field} type="number" min={0} {...register('durationMinutes')} />
                )}
              </FormField>
            </div>
          )}

          {kind === 'EXAM' && (
            <FormField label="Sala" error={examErrors.room?.message}>
              {(field) => <Input {...field} {...register('room')} placeholder="Sala 4" />}
            </FormField>
          )}

          {kind === 'ASSIGNMENT' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Prazo" error={assignmentErrors.dueDate?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="dueDate"
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

              <FormField label="Prioridade">
                {(field) => (
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field: controlled }) => (
                      <Select
                        value={controlled.value ?? 'MEDIUM'}
                        onValueChange={controlled.onChange}
                      >
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
          )}

          {kind === 'ASSIGNMENT' && (
            <FormField label="Pontuação máxima" error={assignmentErrors.maxPoints?.message}>
              {(field) => <Input {...field} type="number" min={0} {...register('maxPoints')} />}
            </FormField>
          )}

          {kind === 'EVENT' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Início" error={eventErrors.startsAt?.message} required>
                {(field) => (
                  <Controller
                    control={control}
                    name="startsAt"
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

              <FormField label="Término" error={eventErrors.endsAt?.message} required>
                {(field) => (
                  <Controller
                    control={control}
                    name="endsAt"
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
            </div>
          )}

          <FormField label="Descrição" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                placeholder="Detalhes, conteúdo, critérios..."
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
                <Plus className="size-4" aria-hidden />
              )}
              Publicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
