'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChartColumn, ListChecks, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/spinner';
import { GoogleIcon } from '@/components/google-icon';
import { Logo } from '@/components/brand/logo';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';

/**
 * Tela de login.
 *
 * Dois métodos convivem lado a lado desde a Etapa 26: e-mail/senha (formulário
 * próprio) e Google (navegação completa - o consentimento acontece no
 * domínio do Google e o retorno precisa carregar o cookie httpOnly).
 */

/** Mensagens dos codigos de erro devolvidos pelo callback da API. */
const ERROR_MESSAGES: Record<string, string> = {
  acesso_negado: 'Você cancelou a autorização. Tente novamente para entrar.',
  estado_invalido: 'A sessão de login expirou. Tente novamente.',
  codigo_ausente: 'O Google não retornou os dados esperados. Tente novamente.',
  falha_google: 'Não foi possível concluir a autenticação com o Google.',
  // Cobre tanto "Google já vinculado a outra conta" quanto "este e-mail já
  // tem cadastro por senha, ainda não confirmado" (Etapa 26) - os dois casos
  // chegam aqui como o mesmo código de erro.
  conflict: 'Este e-mail já tem uma conta. Entre com sua senha, ou use "Esqueci minha senha".',
  sessao_expirada: 'Sua sessão expirou. Entre novamente para continuar.',
  falha_login: 'Não foi possível entrar. Tente novamente em instantes.',
};

const HIGHLIGHTS = [
  { icon: ListChecks, text: 'Atividades e prazos em um só lugar' },
  { icon: CalendarDays, text: 'Provas e calendário integrados' },
  { icon: ChartColumn, text: 'Notas e médias sempre atualizadas' },
];

function LoginContent() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.falha_login) : null;

  // Quem já tem sessão não precisa ver o login.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <FullPageSpinner label="Verificando sessao" />;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/*
            Aqui a marca é o próprio título: o `h1` da página é o lockup, e não
            um texto repetindo o nome logo abaixo dele.
          */}
          <h1>
            <Logo markClassName="size-14" className="flex-col gap-3 text-xl sm:text-2xl" />
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Entre com sua conta para começar.'
              : 'Crie sua conta para começar.'}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {mode === 'login' ? (
            <LoginForm onSuccess={() => router.replace('/dashboard')} />
          ) : (
            <RegisterForm onSuccess={() => router.replace('/dashboard')} />
          )}

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button onClick={() => login()} variant="outline" className="w-full">
            <GoogleIcon className="size-4" />
            Continuar com Google
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-medium text-foreground hover:underline"
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-medium text-foreground hover:underline"
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams exige Suspense em paginas pre-renderizadas.
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LoginContent />
    </Suspense>
  );
}
