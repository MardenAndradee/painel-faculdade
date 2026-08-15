'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, TriangleAlert } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '@painel/shared';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import { FullPageSpinner } from '@/components/ui/spinner';
import { Logo } from '@/components/brand/logo';
import { toast } from 'sonner';

/**
 * Redefinição de senha via token de e-mail (Etapa 26, Fluxo 9).
 *
 * A confirmação de senha é validação puramente do CLIENTE - o backend só
 * recebe `{ token, password }` (`resetPasswordSchema`), então o campo extra
 * fica de fora do schema compartilhado.
 */
const formSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { applySession } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await authService.resetPassword({
        token: values.token,
        password: values.password,
      });

      applySession(session);
      toast.success('Senha redefinida');
      router.replace('/dashboard');
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível redefinir a senha'));
    }
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo markClassName="size-14" className="flex-col gap-3 text-xl sm:text-2xl" />
          <p className="mt-3 text-sm text-muted-foreground">Escolha uma nova senha.</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {!token ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Link inválido. Peça um novo em &quot;Esqueci minha senha&quot;.</span>
            </div>
          ) : (
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
              <input type="hidden" {...register('token')} />

              <FormField
                label="Nova senha"
                error={errors.password?.message}
                hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
                required
              >
                {(field) => (
                  <PasswordInput {...field} {...register('password')} autoComplete="new-password" />
                )}
              </FormField>

              <FormField label="Confirmar senha" error={errors.confirmPassword?.message} required>
                {(field) => (
                  <PasswordInput
                    {...field}
                    {...register('confirmPassword')}
                    autoComplete="new-password"
                  />
                )}
              </FormField>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Redefinir senha
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

export default function ResetPasswordPage() {
  // useSearchParams exige Suspense em paginas pre-renderizadas.
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
