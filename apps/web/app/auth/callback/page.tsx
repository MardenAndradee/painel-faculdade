'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { FullPageSpinner } from '@/components/ui/spinner';

/**
 * Ponto de retorno do fluxo OAuth.
 *
 * Quando o navegador chega aqui o cookie httpOnly de refresh ja foi gravado
 * pela API. O AuthProvider troca esse cookie pelo access token; esta pagina
 * apenas aguarda o resultado e encaminha o usuario.
 *
 * O access token nunca aparece na URL, justamente para nao vazar no historico
 * do navegador, nos logs de acesso nem no header Referer.
 */
function AuthCallbackContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || hasRedirected.current) return;

    hasRedirected.current = true;

    if (!isAuthenticated) {
      router.replace('/login?error=falha_login');
      return;
    }

    // Autorizacao incremental parte da tela de integracoes e volta para la.
    const destino = searchParams.get('destino');
    const conectado = searchParams.get('conectado');

    router.replace(
      destino === 'integracoes'
        ? `/integracoes?conectado=${conectado ?? 'classroom'}`
        : '/dashboard',
    );
  }, [isLoading, isAuthenticated, router, searchParams]);

  return <FullPageSpinner label="Concluindo login" />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageSpinner label="Concluindo login" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
