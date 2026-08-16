'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  updateSemesterSchema,
  type SemesterListItem,
  type UpdateSemesterInput,
} from '@painel/shared';
import { useUpdateSemester } from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SemesterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester: SemesterListItem | null;
}

/**
 * Edição de semestre.
 *
 * Só o nome é editável (Etapa 31) - ano, período e datas são a identidade do
 * registro, que nasce sozinho a partir do calendário. Mudar isso seria
 * "virar outro semestre", não editar o atual.
 */
export function SemesterFormDialog({ open, onOpenChange, semester }: SemesterFormDialogProps) {
  const updateSemester = useUpdateSemester();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSemesterInput>({
    resolver: zodResolver(updateSemesterSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (!open || !semester) return;

    reset({ name: semester.name });
  }, [open, semester, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!semester) return;

    try {
      await updateSemester.mutateAsync({ id: semester.id, data: values });
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar semestre</DialogTitle>
          <DialogDescription>
            Só o nome pode ser alterado — ano e período são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => <Input {...field} {...register('name')} placeholder="2026.1" autoFocus />}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
