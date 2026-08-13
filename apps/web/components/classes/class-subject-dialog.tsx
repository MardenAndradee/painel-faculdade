'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  classSubjectInputSchema,
  type ClassSubjectFormValues,
  type ClassSubjectInput,
  type ClassSubjectItem,
  type SubjectListItem,
} from '@painel/shared';
import { useAddClassSubject, useUpdateClassSubject } from '@/hooks/use-classes';
import { useSubjects } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { ColorPicker } from '@/components/subjects/color-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subjectInitials } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClassSubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  /** Presente na edição; ausente na criação. */
  subject?: ClassSubjectItem | null;
}

const DEFAULT_COLOR = '#6366f1';

const emptyValues: ClassSubjectFormValues = {
  name: '',
  code: '',
  color: DEFAULT_COLOR,
  teacherName: '',
};

/**
 * Adiciona ou edita uma disciplina-molde da turma.
 *
 * Renomear aqui propaga o novo nome para a `Subject` de todo membro já
 * vinculado (decisão registrada no README - "Renomear propaga"): quem manda
 * no nome da disciplina da turma é o dono, o membro não diverge esse campo.
 */
export function ClassSubjectDialog({
  open,
  onOpenChange,
  classId,
  subject,
}: ClassSubjectDialogProps) {
  const isEditing = Boolean(subject);
  const addSubject = useAddClassSubject();
  const updateSubject = useUpdateClassSubject();

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExisting, setSelectedExisting] = useState<Set<string>>(new Set());
  const [addingExisting, setAddingExisting] = useState(false);

  const { data: mySubjects, isLoading: mySubjectsLoading } = useSubjects({ page: 1, perPage: 100 });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassSubjectFormValues, unknown, ClassSubjectInput>({
    resolver: zodResolver(classSubjectInputSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    setMode('new');
    setSelectedExisting(new Set());

    reset(
      subject
        ? {
            name: subject.name,
            code: subject.code ?? '',
            color: subject.color,
            teacherName: subject.teacherName ?? '',
          }
        : emptyValues,
    );
  }, [open, subject, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && subject) {
        await updateSubject.mutateAsync({ classId, subjectId: subject.id, data: values });
      } else {
        await addSubject.mutateAsync({ classId, data: values });
      }

      onOpenChange(false);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  });

  const toggleExisting = (id: string): void => {
    setSelectedExisting((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const availableSubjects = mySubjects?.data ?? [];
  const allExistingSelected =
    availableSubjects.length > 0 &&
    availableSubjects.every((item) => selectedExisting.has(item.id));

  const toggleAllExisting = (): void => {
    setSelectedExisting(
      allExistingSelected ? new Set() : new Set(availableSubjects.map((item) => item.id)),
    );
  };

  /** Vincula cada disciplina escolhida direto por id - uma chamada por vez, mesmo padrão do upload em lote. */
  const handleAddExisting = async (): Promise<void> => {
    const chosen: SubjectListItem[] = availableSubjects.filter((item) =>
      selectedExisting.has(item.id),
    );

    setAddingExisting(true);

    try {
      for (const item of chosen) {
        await addSubject.mutateAsync({
          classId,
          data: {
            name: item.name,
            code: item.code ?? '',
            color: item.color,
            teacherName: item.teacher?.name ?? '',
            existingSubjectId: item.id,
          },
        });
      }

      onOpenChange(false);
    } finally {
      setAddingExisting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar disciplina' : 'Adicionar disciplina'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'O novo nome é aplicado à disciplina de todo membro já vinculado.'
              : 'Ao entrar, cada membro ganha essa disciplina montada automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'new' | 'existing')}>
            <TabsList>
              <TabsTrigger value="new">Nova disciplina</TabsTrigger>
              <TabsTrigger value="existing">Já tenho essa disciplina</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === 'existing' && !isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                O vínculo é direto - sem depender do nome bater.
              </p>
              {availableSubjects.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={toggleAllExisting}
                >
                  {allExistingSelected ? 'Limpar' : 'Selecionar todas'}
                </button>
              )}
            </div>

            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {mySubjectsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : availableSubjects.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Você ainda não tem nenhuma disciplina cadastrada.
                </p>
              ) : (
                availableSubjects.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExisting.has(item.id)}
                      onChange={() => toggleExisting(item.id)}
                      className="size-4 shrink-0 rounded border-input accent-primary"
                    />
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
                      style={{ backgroundColor: `${item.color}1f`, color: item.color }}
                      aria-hidden
                    >
                      {subjectInitials(item.name, item.code)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </label>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={selectedExisting.size === 0 || addingExisting}
                onClick={() => void handleAddExisting()}
              >
                {addingExisting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Adicionar {selectedExisting.size > 0 ? `(${selectedExisting.size})` : ''}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
            <FormField label="Nome" error={errors.name?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('name')}
                  placeholder="Redes de Computadores"
                  autoFocus
                />
              )}
            </FormField>

            <FormField label="Código" error={errors.code?.message}>
              {(field) => <Input {...field} {...register('code')} placeholder="RC101" />}
            </FormField>

            <FormField label="Professor" error={errors.teacherName?.message}>
              {(field) => (
                <Input {...field} {...register('teacherName')} placeholder="Nome do professor" />
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
                {isEditing ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
