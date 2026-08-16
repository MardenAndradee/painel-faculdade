'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Library, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  createClassSchema,
  updateClassSchema,
  SUBJECT_COLORS,
  type ClassDetail,
  type ClassFormValues,
  type CreateClassInput,
} from '@painel/shared';
import { useCreateClass, useUpdateClass } from '@/hooks/use-classes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { ColorPicker } from '@/components/subjects/color-picker';
import { ExistingSubjectsPicker } from '@/components/classes/existing-subjects-picker';
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

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente na edição; ausente na criação. */
  classItem?: ClassDetail | null;
}

const DEFAULT_COLOR = '#4f7cff';

const CREATE_DEFAULTS: ClassFormValues = {
  name: '',
  period: 1,
  description: '',
  color: DEFAULT_COLOR,
  subjects: [],
};

const COURSE_PERIODS = Array.from({ length: 8 }, (_, index) => index + 1);

/**
 * Criação e edição de turma.
 *
 * O `Semester` canônico da turma nunca é escolhido aqui - a criação sempre
 * resolve (ou cria) o semestre atual do dono automaticamente pela data
 * (Etapa 31); trocar isso depois só acontece via "Finalizar semestre"
 * (Etapa 30). Só a criação pede disciplinas iniciais. Em edição, ficam Nome,
 * Cor, Descrição e Período - o mesmo padrão de `ClassSubjectDialog`
 * (`isEditing = Boolean(...)`).
 *
 * As disciplinas iniciais aqui só levam nome e código - cor, professor e
 * créditos ficam para a edição na própria turma depois de criada. Cadastrar
 * tudo de uma vez num formulário grande é justamente o atrito que a entrada
 * automática por convite (Etapa 20) existe para poupar do MEMBRO; o dono
 * ainda precisa digitar a lista uma vez, mas não precisa fazê-lo perfeito.
 */
export function ClassFormDialog({ open, onOpenChange, classItem }: ClassFormDialogProps) {
  const isEditing = Boolean(classItem);
  const router = useRouter();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues, unknown, CreateClassInput>({
    // Em edição, o resolver valida um subconjunto dos campos (sem year/term/
    // subjects) - o cast é seguro porque `onSubmit` só lê os campos que cada
    // modo realmente usa, nunca os dois ao mesmo tempo.
    resolver: zodResolver(isEditing ? updateClassSchema : createClassSchema) as unknown as Resolver<
      ClassFormValues,
      unknown,
      CreateClassInput
    >,
    defaultValues: CREATE_DEFAULTS,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'subjects' });

  useEffect(() => {
    if (!open) return;

    if (classItem) {
      reset({
        name: classItem.name,
        period: classItem.period,
        description: classItem.description ?? '',
        color: classItem.color,
        subjects: [],
      });
    } else {
      reset(CREATE_DEFAULTS);
    }
  }, [open, classItem, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && classItem) {
        await updateClass.mutateAsync({
          id: classItem.id,
          data: {
            name: values.name,
            description: values.description,
            color: values.color,
            period: values.period,
          },
        });
        onOpenChange(false);
        return;
      }

      const payload: CreateClassInput = {
        ...values,
        // Disciplina vinda do picker já traz a cor real dela; só a digitada do
        // zero ganha a cor do ciclo automático.
        subjects: values.subjects.map((subject, index) =>
          subject.existingSubjectId
            ? subject
            : { ...subject, color: SUBJECT_COLORS[index % SUBJECT_COLORS.length] ?? DEFAULT_COLOR },
        ),
      };

      const created = await createClass.mutateAsync(payload);
      onOpenChange(false);
      router.push(`/turmas/${created.id}`);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar turma' : 'Nova turma'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Ano e semestre só mudam ao finalizar o semestre da turma.'
              : 'Crie uma turma para compartilhar avisos e atividades com os colegas.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void onSubmit(event)}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          noValidate
        >
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('name')}
                placeholder="Redes de Computadores - T01"
                autoFocus
              />
            )}
          </FormField>

          <FormField
            label="Período"
            error={errors.period?.message}
            required
            hint="Progresso da turma no curso - 1º a 8º"
          >
            {(field) => (
              <Controller
                control={control}
                name="period"
                render={({ field: controlled }) => (
                  <Select
                    value={String(controlled.value ?? 1)}
                    onValueChange={(value) => controlled.onChange(Number(value))}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_PERIODS.map((period) => (
                        <SelectItem key={period} value={String(period)}>
                          {period}º período
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>

          <FormField label="Cor" error={errors.color?.message}>
            {(field) => (
              <Controller
                control={control}
                name="color"
                render={({ field: controlled }) => (
                  <ColorPicker
                    id={field.id}
                    value={controlled.value ?? DEFAULT_COLOR}
                    onChange={controlled.onChange}
                  />
                )}
              />
            )}
          </FormField>

          <FormField label="Descrição" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                placeholder="Sobre o que é essa turma, combinados, etc."
                rows={2}
              />
            )}
          </FormField>

          {!isEditing && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Disciplinas iniciais</p>
                <div className="flex items-center">
                  <ExistingSubjectsPicker
                    excludeIds={fields
                      .map((field) => field.existingSubjectId)
                      .filter((id): id is string => Boolean(id))}
                    onConfirm={(subjects) => {
                      for (const subject of subjects) {
                        append({
                          name: subject.name,
                          code: subject.code ?? '',
                          color: subject.color,
                          teacherName: subject.teacher?.name ?? '',
                          existingSubjectId: subject.id,
                        });
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => append({ name: '', code: '' })}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Nova
                  </Button>
                </div>
              </div>

              {fields.length === 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Opcional - dá para adicionar disciplinas depois de criar a turma.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      {field.existingSubjectId && (
                        <Library
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Vinculada a uma disciplina sua"
                        />
                      )}
                      <Input
                        {...register(`subjects.${index}.name`)}
                        placeholder="Nome da disciplina"
                        className="flex-1"
                      />
                      <Input
                        {...register(`subjects.${index}.code`)}
                        placeholder="Código"
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground"
                        onClick={() => remove(index)}
                        aria-label="Remover disciplina"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              {isEditing ? 'Salvar' : 'Criar turma'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
