'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  editAttachmentFormSchema,
  type AttachmentListItem,
  type EditAttachmentFormValues,
} from '@painel/shared';
import { useUpdateAttachment } from '@/hooks/use-attachments';
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

interface AttachmentEditDialogProps {
  attachment: AttachmentListItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edicao de material.
 *
 * So o rotulo e a disciplina mudam. Trocar o arquivo seria, na pratica, outro
 * material - entao a operacao correta e enviar de novo e excluir o antigo.
 */
export function AttachmentEditDialog({ attachment, onOpenChange }: AttachmentEditDialogProps) {
  const updateAttachment = useUpdateAttachment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditAttachmentFormValues>({
    resolver: zodResolver(editAttachmentFormSchema),
    defaultValues: { name: '', subjectId: '' },
  });

  useEffect(() => {
    if (!attachment) return;

    reset({ name: attachment.name, subjectId: attachment.subject?.id ?? '' });
  }, [attachment, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!attachment) return;

    try {
      await updateAttachment.mutateAsync({
        id: attachment.id,
        data: { name: values.name, subjectId: values.subjectId ?? '' },
      });

      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={attachment !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar material</DialogTitle>
          <DialogDescription>Altere o nome e a disciplina deste material.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => <Input {...field} {...register('name')} autoFocus />}
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
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
