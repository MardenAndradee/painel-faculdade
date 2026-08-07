'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createSemesterSchema,
  SEMESTER_STATUS,
  type CreateSemesterInput,
  type SemesterFormValues,
  type SemesterListItem,
} from '@painel/shared';
import { useCreateSemester, useUpdateSemester } from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface SemesterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester?: SemesterListItem | null;
}

const STATUS_LABELS: Record<(typeof SEMESTER_STATUS)[number], string> = {
  PLANNED: 'Planejado',
  ACTIVE: 'Em andamento',
  FINISHED: 'Encerrado',
};

export function SemesterFormDialog({ open, onOpenChange, semester }: SemesterFormDialogProps) {
  const isEditing = Boolean(semester);
  const createSemester = useCreateSemester();
  const updateSemester = useUpdateSemester();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SemesterFormValues, unknown, CreateSemesterInput>({
    resolver: zodResolver(createSemesterSchema),
    defaultValues: { name: '', year: new Date().getFullYear(), term: 1, status: 'ACTIVE' },
  });

  useEffect(() => {
    if (!open) return;

    if (semester) {
      reset({
        name: semester.name,
        year: semester.year,
        term: semester.term,
        status: semester.status,
        isCurrent: semester.isCurrent,
        startDate: semester.startDate.slice(0, 10),
        endDate: semester.endDate.slice(0, 10),
      });
    } else {
      // Sugere o período conforme o mês atual: até junho é o primeiro.
      const now = new Date();
      const term = now.getMonth() < 6 ? 1 : 2;
      const year = now.getFullYear();

      reset({
        name: `${year}.${term}`,
        year,
        term,
        status: 'ACTIVE',
        isCurrent: true,
        startDate: new Date(year, term === 1 ? 1 : 7, 1).toISOString().slice(0, 10),
        endDate: new Date(year, term === 1 ? 5 : 11, 30).toISOString().slice(0, 10),
      });
    }
  }, [open, semester, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && semester) {
        await updateSemester.mutateAsync({ id: semester.id, data: values });
      } else {
        await createSemester.mutateAsync(values);
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
          <DialogTitle>{isEditing ? 'Editar semestre' : 'Novo semestre'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do período letivo.'
              : 'Cadastre um período para organizar as disciplinas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => <Input {...field} {...register('name')} placeholder="2026.1" autoFocus />}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ano" error={errors.year?.message} required>
              {(field) => (
                <Input {...field} {...register('year')} type="number" min={2000} max={2100} />
              )}
            </FormField>

            <FormField label="Período" error={errors.term?.message} required hint="1 ou 2">
              {(field) => (
                <Controller
                  control={control}
                  name="term"
                  render={({ field: controlled }) => (
                    <Select
                      value={String(controlled.value ?? 1)}
                      onValueChange={(value) => controlled.onChange(Number(value))}
                    >
                      <SelectTrigger id={field.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1º semestre</SelectItem>
                        <SelectItem value="2">2º semestre</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Início" error={errors.startDate?.message} required>
              {(field) => (
                <Controller
                  control={control}
                  name="startDate"
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

            <FormField label="Término" error={errors.endDate?.message} required>
              {(field) => (
                <Controller
                  control={control}
                  name="endDate"
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
                      {SEMESTER_STATUS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>

          <FormField label="Semestre atual" error={errors.isCurrent?.message}>
            {(field) => (
              <Controller
                control={control}
                name="isCurrent"
                render={({ field: controlled }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      id={field.id}
                      type="checkbox"
                      checked={controlled.value === true}
                      onChange={(event) => controlled.onChange(event.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="text-muted-foreground">
                      Usar como período padrão no dashboard
                    </span>
                  </label>
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
              {isEditing ? 'Salvar' : 'Criar semestre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
