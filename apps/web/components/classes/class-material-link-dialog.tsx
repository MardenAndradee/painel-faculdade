'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Loader2 } from 'lucide-react';
import {
  createClassMaterialLinkSchema,
  type ClassMaterialLinkFormValues,
  type CreateClassMaterialLinkInput,
} from '@painel/shared';
import { useCreateClassMaterialLink } from '@/hooks/use-class-materials';
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

interface ClassMaterialLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
}

/** Cadastro de material do tipo link, visível para toda a turma. */
export function ClassMaterialLinkDialog({
  open,
  onOpenChange,
  classId,
}: ClassMaterialLinkDialogProps) {
  const createLink = useCreateClassMaterialLink(classId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassMaterialLinkFormValues, unknown, CreateClassMaterialLinkInput>({
    resolver: zodResolver(createClassMaterialLinkSchema),
    defaultValues: { name: '', url: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', url: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createLink.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar link</DialogTitle>
          <DialogDescription>Visível para todo membro da turma.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => (
              <Input {...field} {...register('name')} placeholder="Slides da aula 4" autoFocus />
            )}
          </FormField>

          <FormField label="Endereço" error={errors.url?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('url')}
                type="url"
                inputMode="url"
                placeholder="https://..."
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
                <Link2 className="size-4" aria-hidden />
              )}
              Adicionar link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
