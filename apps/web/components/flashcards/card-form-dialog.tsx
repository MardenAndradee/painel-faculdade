'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  flashcardFormSchema,
  type FlashcardFormFields,
  type FlashcardListItem,
} from '@painel/shared';
import { useCreateFlashcard, useUpdateFlashcard } from '@/hooks/use-flashcards';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

interface CardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  card?: FlashcardListItem | null;
  /** Mantém o diálogo aberto após criar, para digitar vários seguidos. */
  keepOpenOnCreate?: boolean;
}

export function CardFormDialog({
  open,
  onOpenChange,
  deckId,
  card,
  keepOpenOnCreate = true,
}: CardFormDialogProps) {
  const isEditing = Boolean(card);
  const createCard = useCreateFlashcard();
  const updateCard = useUpdateFlashcard();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FlashcardFormFields>({
    // Um resolver só para os dois modos: criar e editar mexem nos mesmos
    // campos. O `deckId` vem da rota, não do formulário.
    resolver: zodResolver(flashcardFormSchema),
    defaultValues: { front: '', back: '', hint: '' },
  });

  useEffect(() => {
    if (!open) return;

    reset(
      card
        ? { front: card.front, back: card.back, hint: card.hint ?? '' }
        : { front: '', back: '', hint: '' },
    );
  }, [open, card, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && card) {
        await updateCard.mutateAsync({
          id: card.id,
          data: { front: values.front, back: values.back, hint: values.hint },
        });
        onOpenChange(false);
        return;
      }

      await createCard.mutateAsync({
        deckId,
        front: values.front,
        back: values.back,
        hint: values.hint,
      });

      if (keepOpenOnCreate) {
        // Cadastrar cartões é uma tarefa repetitiva: limpar e devolver o foco
        // à frente evita reabrir o diálogo a cada cartão.
        reset({ front: '', back: '', hint: '' });
        setFocus('front');
      } else {
        onOpenChange(false);
      }
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Alterar o texto não afeta o agendamento de revisão.'
              : 'A frente é a pergunta; o verso, o que você precisa lembrar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Frente" error={errors.front?.message} required>
            {(field) => (
              <Textarea
                {...field}
                {...register('front')}
                rows={3}
                placeholder="Derivada de sen(x)"
                autoFocus
              />
            )}
          </FormField>

          <FormField label="Verso" error={errors.back?.message} required>
            {(field) => <Textarea {...field} {...register('back')} rows={3} placeholder="cos(x)" />}
          </FormField>

          <FormField
            label="Dica"
            error={errors.hint?.message}
            hint="Opcional — aparece antes de virar o cartão"
          >
            {(field) => (
              <Input
                {...field}
                {...register('hint')}
                placeholder="Pense no círculo trigonométrico"
              />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isEditing ? 'Cancelar' : 'Fechar'}
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                !isEditing && <Plus className="size-4" aria-hidden />
              )}
              {isEditing ? 'Salvar' : 'Adicionar cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
