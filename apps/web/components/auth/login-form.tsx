'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { loginSchema, type LoginInput } from '@painel/shared';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { toast } from 'sonner';

interface LoginFormProps {
  onSuccess: () => void;
}

/**
 * Login por e-mail e senha (Etapa 26, Fluxo 2).
 *
 * A mensagem de erro do servidor já vem genérica ("E-mail ou senha
 * inválidos") tanto para conta inexistente quanto para senha errada - o
 * formulário só repassa o que veio, sem tentar ser mais específico (isso
 * reintroduziria a enumeração de usuário que o backend evita).
 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const { applySession } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await authService.login(values);

      applySession(session);
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível entrar'));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
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

      <FormField label="Senha" error={errors.password?.message} required>
        {(field) => (
          <PasswordInput {...field} {...register('password')} autoComplete="current-password" />
        )}
      </FormField>

      <div className="flex justify-end">
        <Link href="/esqueci-minha-senha" className="text-xs text-muted-foreground hover:underline">
          Esqueci minha senha
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Entrar
      </Button>
    </form>
  );
}
