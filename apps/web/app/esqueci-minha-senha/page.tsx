'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@painel/shared';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Logo } from '@/components/brand/logo';
import { toast } from 'sonner';

/**
 * "Esqueci minha senha" (Etapa 26, Fluxo 9).
 *
 * A resposta é SEMPRE a mesma tela de sucesso, exista ou não a conta com este
 * e-mail (risco R3) - o backend já garante isso; aqui só exibimos o que ele
 * devolveu, sem ramificar.
 *
 * O link de fato é apenas LOGADO pelo servidor hoje - o envio de e-mail
 * (Etapa 25) ainda não existe. O fluxo fica pronto e só liga de verdade
 * quando o envio existir.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authService.forgotPassword(values);
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível enviar o link'));
    }
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo markClassName="size-14" className="flex-col gap-3 text-xl sm:text-2xl" />
          <p className="mt-3 text-sm text-muted-foreground">
            {sent ? 'Verifique seu e-mail' : 'Informe o e-mail da sua conta.'}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-6" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">
                Se este e-mail tiver uma conta com senha, enviamos um link para redefini-la.
              </p>
            </div>
          ) : (
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

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Enviar link
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
