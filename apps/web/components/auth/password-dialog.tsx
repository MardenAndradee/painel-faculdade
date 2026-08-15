'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@painel/shared';
import { useChangePassword, useSetPassword } from '@/hooks/use-login-methods';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `add` = conta hoje só-Google definindo a primeira senha; `change` = já tem senha e está trocando. */
  mode: 'add' | 'change';
}

/**
 * Schema local do FORMULÁRIO, deliberadamente à parte de `setPasswordSchema`
 * e `changePasswordSchema` (`@painel/shared`): os dois têm formatos
 * diferentes (`password` vs `currentPassword`/`newPassword`), e um resolver
 * escolhido por ternário entre eles não tipa bem com um único `FormValues`.
 * O modo entra como campo do próprio formulário para que UMA regra
 * (`superRefine`) decida se a senha atual é exigida - a submissão então
 * monta o payload que cada rota espera.
 */
const formSchema = z
  .object({
    mode: z.enum(['add', 'change']),
    currentPassword: z.string().optional(),
    newPassword: z
      .string({ error: 'Informe a senha' })
      .min(PASSWORD_MIN_LENGTH, `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
      .max(PASSWORD_MAX_LENGTH, 'Senha muito longa'),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'change' && !data.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Informe a senha atual',
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

/**
 * "Adicionar senha" / "Trocar senha" (Etapa 26, Configurações → Conta).
 *
 * Um componente só para os dois modos: os campos são quase idênticos, e
 * manter dois arquivos separados só duplicaria o formulário para divergir
 * com o tempo.
 */
export function PasswordDialog({ open, onOpenChange, mode }: PasswordDialogProps) {
  const setPassword = useSetPassword();
  const changePassword = useChangePassword();

  const isChange = mode === 'change';
  const isPending = isChange ? changePassword.isPending : setPassword.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { mode, currentPassword: '', newPassword: '' },
  });

  useEffect(() => {
    if (open) reset({ mode, currentPassword: '', newPassword: '' });
  }, [open, mode, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (values.mode === 'change') {
        await changePassword.mutateAsync({
          currentPassword: values.currentPassword ?? '',
          newPassword: values.newPassword,
        });
      } else {
        await setPassword.mutateAsync({ password: values.newPassword });
      }

      onOpenChange(false);
    } catch {
      // O toast de erro já vem do hook. O diálogo fica aberto para correção.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isChange ? 'Trocar senha' : 'Adicionar senha'}</DialogTitle>
          <DialogDescription>
            {isChange
              ? 'Confirme sua senha atual para escolher uma nova.'
              : 'Defina uma senha para entrar sem depender do Google.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          {isChange && (
            <FormField label="Senha atual" error={errors.currentPassword?.message} required>
              {(field) => (
                <PasswordInput
                  {...field}
                  {...register('currentPassword')}
                  autoComplete="current-password"
                />
              )}
            </FormField>
          )}

          <FormField
            label="Nova senha"
            error={errors.newPassword?.message}
            hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
            required
          >
            {(field) => (
              <PasswordInput {...field} {...register('newPassword')} autoComplete="new-password" />
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button type="submit" disabled={isSubmitting || isPending}>
              {(isSubmitting || isPending) && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
