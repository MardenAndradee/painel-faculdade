'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { FullPageSpinner, Spinner } from '@/components/ui/spinner';
import { Logo } from '@/components/brand/logo';

type Status = 'checking' | 'success' | 'error';

/**
 * Confirmação de e-mail (Etapa 26, Fluxo 1).
 *
 * A verificação dispara sozinha ao abrir a página - é para isso que o link
 * do e-mail serve. `hasRun` evita chamar duas vezes em desenvolvimento (o
 * StrictMode do React invoca `useEffect` duas vezes) e, mais importante,
 * numa navegação normal: o token é de uso único, e uma segunda chamada
 * devolveria erro mesmo depois de um sucesso real.
 */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const hasRun = useRef(false);

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Link inválido.');
      return;
    }

    authService
      .verifyEmail({ token })
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(errorMessage(error, 'Não foi possível confirmar o e-mail'));
      });
  }, [token]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Logo markClassName="size-14" className="flex-col gap-3 text-xl sm:text-2xl" />

        <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <Spinner className="size-6" />
              <p className="text-sm text-muted-foreground">Confirmando seu e-mail...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-status-completed/10 text-status-completed">
                <CheckCircle2 className="size-6" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">E-mail confirmado com sucesso.</p>
              <Button asChild className="mt-2 w-full">
                <Link href="/dashboard">Ir para o Painel</Link>
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <TriangleAlert className="size-6" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/login">Voltar para o login</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams exige Suspense em paginas pre-renderizadas.
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
