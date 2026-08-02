'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Loader2 } from 'lucide-react';
import {
  createLinkAttachmentSchema,
  type CreateLinkAttachmentInput,
  type LinkAttachmentFormValues,
} from '@painel/shared';
import { useCreateLinkAttachment } from '@/hooks/use-attachments';
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
import { SubjectSelectField } from './subject-select-field';

interface LinkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Cadastro de material do tipo link. */
export function LinkFormDialog({ open, onOpenChange }: LinkFormDialogProps) {
  const createLink = useCreateLinkAttachment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LinkAttachmentFormValues, unknown, CreateLinkAttachmentInput>({
    resolver: zodResolver(createLinkAttachmentSchema),
    defaultValues: { name: '', url: '', subjectId: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', url: '', subjectId: '' });
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
          <DialogDescription>
            Salve um vídeo, artigo ou pasta compartilhada junto dos seus materiais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('name')}
                placeholder="Videoaula de derivadas"
                autoFocus
              />
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

          <SubjectSelectField
            control={control}
            name="subjectId"
            error={errors.subjectId?.message}
          />

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
