'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  createClassAnnouncementSchema,
  type ClassAnnouncementFormValues,
  type ClassAnnouncementItem,
  type CreateClassAnnouncementInput,
} from '@painel/shared';
import {
  useCreateClassAnnouncement,
  useUpdateClassAnnouncement,
} from '@/hooks/use-class-announcements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClassAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  /** Presente na edição; ausente na criação. */
  announcement?: ClassAnnouncementItem | null;
}

const emptyValues: ClassAnnouncementFormValues = { title: '', content: '', pinned: false };

/** Publica ou edita um aviso do Mural. Notifica todo membro, menos o autor. */
export function ClassAnnouncementDialog({
  open,
  onOpenChange,
  classId,
  announcement,
}: ClassAnnouncementDialogProps) {
  const isEditing = Boolean(announcement);
  const create = useCreateClassAnnouncement(classId);
  const update = useUpdateClassAnnouncement(classId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassAnnouncementFormValues, unknown, CreateClassAnnouncementInput>({
    resolver: zodResolver(createClassAnnouncementSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      announcement
        ? { title: announcement.title, content: announcement.content, pinned: announcement.pinned }
        : emptyValues,
    );
  }, [open, announcement, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && announcement) {
        await update.mutateAsync({ announcementId: announcement.id, data: values });
      } else {
        await create.mutateAsync(values);
      }

      onOpenChange(false);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar aviso' : 'Publicar aviso'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'A edição não gera notificação nova.'
              : 'Todo membro da turma é notificado, menos você.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Título" error={errors.title?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('title')}
                placeholder="Prova de Redes mudou"
                autoFocus
              />
            )}
          </FormField>

          <FormField label="Conteúdo" error={errors.content?.message} required>
            {(field) => (
              <Textarea
                {...field}
                {...register('content')}
                rows={4}
                placeholder="A prova N1 foi remarcada para sexta-feira, mesmo horário."
              />
            )}
          </FormField>

          <Controller
            control={control}
            name="pinned"
            render={({ field: controlled }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={controlled.value === true}
                  onChange={(event) => controlled.onChange(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span className="text-muted-foreground">Fixar no topo do Mural</span>
              </label>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isEditing ? 'Salvar' : 'Publicar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
