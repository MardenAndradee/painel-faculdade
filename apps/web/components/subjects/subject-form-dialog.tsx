'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createSubjectSchema,
  SUBJECT_STATUS,
  SUBJECT_STATUS_LABELS,
  type CreateSubjectInput,
  type SubjectFormValues,
  type SubjectListItem,
} from '@painel/shared';
import { useCreateSubject, useTeachers, useUpdateSubject } from '@/hooks/use-subjects';
import { useSemesters } from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { ColorPicker } from './color-picker';
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

/**
 * Formulario de criacao e edicao.
 *
 * O schema Zod vem de `@painel/shared` - o mesmo que a API usa para validar,
 * entao o formulario nunca aceita algo que o servidor recusaria.
 */

interface SubjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente na edicao; ausente na criacao. */
  subject?: SubjectListItem | null;
}

/** Valor sentinela do Select: o Radix nao aceita item com value vazio. */
const NO_TEACHER = '__none__';
const NEW_TEACHER = '__new__';
const NO_SEMESTER = '__none__';

const DEFAULT_COLOR = '#6366f1';

export function SubjectFormDialog({ open, onOpenChange, subject }: SubjectFormDialogProps) {
  const isEditing = Boolean(subject);
  const { data: teachers = [] } = useTeachers();
  const { data: semesters = [] } = useSemesters();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();

  const [teacherMode, setTeacherMode] = useState<string>(NO_TEACHER);

  // Tres generics: valores do formulario (entrada), contexto e valores
  // transformados (saida do Zod, com os defaults ja aplicados).
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues, unknown, CreateSubjectInput>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      color: DEFAULT_COLOR,
      semesterId: null,
      passingGrade: 6,
      status: 'IN_PROGRESS',
    },
  });

  // Recarrega os valores sempre que o diálogo abre: sem isso, editar uma
  // disciplina e depois criar outra reaproveitaria os dados anteriores.
  useEffect(() => {
    if (!open) return;

    if (subject) {
      reset({
        name: subject.name,
        code: subject.code ?? '',
        description: '',
        color: subject.color,
        semesterId: subject.semester?.id ?? null,
        passingGrade: subject.passingGrade,
        status: subject.status,
        teacherId: subject.teacher?.id ?? null,
      });
      setTeacherMode(subject.teacher?.id ?? NO_TEACHER);
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        color: DEFAULT_COLOR,
        semesterId: null,
        passingGrade: 6,
        status: 'IN_PROGRESS',
      });
      setTeacherMode(NO_TEACHER);
    }
  }, [open, subject, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // Traduz o modo escolhido no Select para os campos que a API espera.
    const payload: CreateSubjectInput = {
      ...values,
      teacherId: teacherMode === NO_TEACHER || teacherMode === NEW_TEACHER ? null : teacherMode,
      newTeacherName: teacherMode === NEW_TEACHER ? values.newTeacherName : '',
    };

    try {
      if (isEditing && subject) {
        await updateSubject.mutateAsync({ id: subject.id, data: payload });
      } else {
        await createSubject.mutateAsync(payload);
      }

      onOpenChange(false);
    } catch {
      // O toast de erro ja e disparado pelo hook. O dialogo permanece aberto
      // com os dados preenchidos para que o usuario corrija e tente de novo.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar disciplina' : 'Nova disciplina'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações da disciplina.'
              : 'Cadastre uma disciplina para organizar atividades, provas e notas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => (
              <Input {...field} {...register('name')} placeholder="Cálculo III" autoFocus />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Código" error={errors.code?.message}>
              {(field) => <Input {...field} {...register('code')} placeholder="MA203" />}
            </FormField>

            <FormField label="Semestre" error={errors.semesterId?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="semesterId"
                  render={({ field: controlled }) => (
                    <Select
                      value={controlled.value ?? NO_SEMESTER}
                      onValueChange={(value) =>
                        controlled.onChange(value === NO_SEMESTER ? null : value)
                      }
                    >
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NO_SEMESTER}>Sem semestre</SelectItem>
                        {semesters.map((semester) => (
                          <SelectItem key={semester.id} value={semester.id}>
                            {semester.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </div>

          <FormField label="Professor" error={errors.newTeacherName?.message}>
            {(field) => (
              <div className="space-y-2">
                <Select value={teacherMode} onValueChange={setTeacherMode}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NO_TEACHER}>Sem professor</SelectItem>

                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}

                    <SelectItem value={NEW_TEACHER}>+ Cadastrar novo professor</SelectItem>
                  </SelectContent>
                </Select>

                {/* Cadastro inline: evita sair da tela e voltar só para
                    registrar um professor. */}
                {teacherMode === NEW_TEACHER && (
                  <Input
                    {...register('newTeacherName')}
                    placeholder="Nome do professor"
                    aria-label="Nome do novo professor"
                  />
                )}
              </div>
            )}
          </FormField>

          <FormField
            label="Nota para aprovação"
            error={errors.passingGrade?.message}
            hint="Varia por instituição"
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
              />
            )}
          </FormField>

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
                      {SUBJECT_STATUS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {SUBJECT_STATUS_LABELS[status]}
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
                  // `color` tem `.default()` no schema, entao no tipo de
                  // entrada e opcional; o fallback cobre o primeiro render.
                  <ColorPicker
                    id={field.id}
                    value={controlled.value ?? DEFAULT_COLOR}
                    onChange={controlled.onChange}
                  />
                )}
              />
            )}
          </FormField>

          <FormField label="Observações" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                placeholder="Ementa, bibliografia, critérios de avaliação..."
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
              {isEditing ? 'Salvar' : 'Criar disciplina'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
