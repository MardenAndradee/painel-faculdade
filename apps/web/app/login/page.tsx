'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChartColumn, ListChecks, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/spinner';
import { GoogleIcon } from '@/components/google-icon';
import { Logo } from '@/components/brand/logo';

/**
 * Tela de login.
 *
 * O botao dispara uma navegacao completa para a API, que redireciona ao
 * consentimento do Google. Nao ha formulario: a identidade e inteiramente
 * delegada ao provedor.
 */

/** Mensagens dos codigos de erro devolvidos pelo callback da API. */
const ERROR_MESSAGES: Record<string, string> = {
  acesso_negado: 'Você cancelou a autorização. Tente novamente para entrar.',
  estado_invalido: 'A sessão de login expirou. Tente novamente.',
  codigo_ausente: 'O Google não retornou os dados esperados. Tente novamente.',
  falha_google: 'Não foi possível concluir a autenticação com o Google.',
  conflict: 'Este e-mail já está vinculado a outra conta Google.',
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
            Entre com sua conta institucional para começar.
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
          <Button onClick={() => login()} size="lg" variant="outline" className="w-full">
            <GoogleIcon className="size-4" />
            Entrar com Google
          </Button>

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Pedimos apenas seu nome, e-mail e foto. O acesso ao Classroom e ao Calendar é solicitado
            depois, só quando você ativar a sincronização.
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
