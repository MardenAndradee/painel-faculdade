'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from '@painel/shared';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { toast } from 'sonner';

interface RegisterFormProps {
  onSuccess: () => void;
}

/**
 * Cadastro por e-mail e senha (Etapa 26, Fluxo 1).
 *
 * Loga imediatamente após criar a conta - sem esperar a confirmação do
 * e-mail (a política é fricção baixa: a pessoa já está dentro, e o aviso de
 * "confirme seu e-mail" aparece depois, dentro do produto). O backend envia
 * o link de verificação em paralelo.
 */
export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { applySession } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await authService.register(values);

      applySession(session);
      toast.success('Conta criada', {
        description: 'Enviamos um link de confirmação para o seu e-mail.',
      });
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível criar a conta'));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      <FormField label="Nome" error={errors.name?.message} required>
        {(field) => (
          <Input {...field} {...register('name')} autoComplete="name" placeholder="Seu nome" />
        )}
      </FormField>

      <FormField label="E-mail" error={errors.email?.message} required>
        {(field) => (
          <Input
            {...field}
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
        )}
      </FormField>

      <FormField
        label="Senha"
        error={errors.password?.message}
        hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
        required
      >
        {(field) => (
          <PasswordInput {...field} {...register('password')} autoComplete="new-password" />
        )}
      </FormField>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Criar conta
      </Button>
    </form>
  );
}
