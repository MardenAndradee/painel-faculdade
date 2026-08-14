'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  createDeckSchema,
  type CreateDeckInput,
  type DeckFormValues,
  type DeckListItem,
} from '@painel/shared';
import { useCreateDeck, useUpdateDeck } from '@/hooks/use-flashcards';
import { useCreateExamPrepDeck } from '@/hooks/use-exam-preps';
import { useSubjects } from '@/hooks/use-subjects';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DeckFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck?: DeckListItem | null;
  /**
   * Presente quando o baralho nasce de dentro de um Plano de Estudos (Etapa
   * 27) - o baralho já sai vinculado, e a criação não navega pra fora do
   * plano (o `/flashcards/:id` continua existindo, só não é o próximo passo
   * aqui).
   */
  examPrepId?: string;
}

/** O Radix nao aceita `value=""` num item. */
const NO_SUBJECT = 'none';

/** Paleta fixa: cores escolhidas a dedo legiveis nos dois temas. */
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

export function DeckFormDialog({ open, onOpenChange, deck, examPrepId }: DeckFormDialogProps) {
  const isEditing = Boolean(deck);
  const router = useRouter();
  const createDeck = useCreateDeck();
  const createExamPrepDeck = useCreateExamPrepDeck(examPrepId ?? '');
  const updateDeck = useUpdateDeck();
  const { data: subjects } = useSubjects({ page: 1, perPage: 100 });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeckFormValues, unknown, CreateDeckInput>({
    resolver: zodResolver(createDeckSchema),
    defaultValues: { name: '', description: '', subjectId: '', color: COLORS[0] },
  });

  useEffect(() => {
    if (!open) return;

    reset(
      deck
        ? {
            name: deck.name,
            description: deck.description ?? '',
            subjectId: deck.subject?.id ?? '',
            color: deck.color,
          }
        : { name: '', description: '', subjectId: '', color: COLORS[0] },
    );
  }, [open, deck, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && deck) {
        await updateDeck.mutateAsync({ id: deck.id, data: values });
        onOpenChange(false);
      } else if (examPrepId) {
        // Criado de dentro de um plano: fica na própria tela do plano - o
        // baralho novo aparece na seção de Flashcards ali mesmo.
        await createExamPrepDeck.mutateAsync(values);
        onOpenChange(false);
      } else {
        const created = await createDeck.mutateAsync(values);
        onOpenChange(false);
        // Baralho novo nao tem cartao nenhum ainda - vai direto pra tela dele
        // em vez de fazer o usuario reabrir o diálogo pra achar o que acabou
        // de criar na lista.
        router.push(`/flashcards/${created.id}`);
      }
    } catch {
      // O toast de erro vem do hook; o diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar baralho' : 'Novo baralho'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize o nome, a cor e a disciplina.'
              : 'Agrupe cartões por assunto: "Fórmulas de derivada", "Verbos irregulares".'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormField label="Nome" error={errors.name?.message} required>
            {(field) => (
              <Input
                {...field}
                {...register('name')}
                placeholder="Fórmulas de derivada"
                autoFocus
              />
            )}
          </FormField>

          <FormField label="Descrição" error={errors.description?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('description')}
                rows={2}
                placeholder="O que este baralho cobre"
              />
            )}
          </FormField>

          <FormField label="Disciplina" error={errors.subjectId?.message} hint="Opcional">
            {(field) => (
              <Controller
                control={control}
                name="subjectId"
                render={({ field: controlled }) => (
                  <Select
                    value={controlled.value ? controlled.value : NO_SUBJECT}
                    onValueChange={(value) =>
                      controlled.onChange(value === NO_SUBJECT ? '' : value)
                    }
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Sem disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUBJECT}>Sem disciplina</SelectItem>
                      {subjects?.data.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
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
                  <div className="flex flex-wrap gap-2" id={field.id}>
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Cor ${color}`}
                        aria-pressed={controlled.value === color}
                        onClick={() => controlled.onChange(color)}
                        style={{ backgroundColor: color }}
                        className={`size-8 rounded-full transition-all ${
                          controlled.value === color
                            ? 'ring-2 ring-ring ring-offset-2'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
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
              {isEditing ? 'Salvar' : 'Criar baralho'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
