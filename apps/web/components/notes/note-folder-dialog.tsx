'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { createNoteFolderSchema, type NoteFolderListItem } from '@painel/shared';
import { useCreateNoteFolder, useUpdateNoteFolder } from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormValues {
  name: string;
}

interface NoteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  /** Pasta-mae da nova pasta. Ignorado ao renomear. */
  parentId: string | null;
  /** Presente ao renomear; ausente ao criar. */
  folder?: NoteFolderListItem | null;
}

/** Cria ou renomeia uma pasta de anotacoes. */
export function NoteFolderDialog({
  open,
  onOpenChange,
  subjectId,
  parentId,
  folder,
}: NoteFolderDialogProps) {
  const isEditing = Boolean(folder);
  const createFolder = useCreateNoteFolder(subjectId);
  const updateFolder = useUpdateNoteFolder(subjectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createNoteFolderSchema.pick({ name: true })),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (open) reset({ name: folder?.name ?? '' });
  }, [open, folder, reset]);

  async function onSubmit(values: FormValues): Promise<void> {
    if (folder) {
      await updateFolder.mutateAsync({ id: folder.id, data: { name: values.name } });
    } else {
      await createFolder.mutateAsync({ name: values.name, subjectId, parentId });
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Renomear pasta' : 'Nova pasta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="space-y-4">
          <FormField label="Nome" error={errors.name?.message} required>
            {(fieldProps) => (
              <Input {...fieldProps} {...register('name')} autoFocus placeholder="Ex.: Provas" />
            )}
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
