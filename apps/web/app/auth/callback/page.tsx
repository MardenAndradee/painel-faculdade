'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { FullPageSpinner } from '@/components/ui/spinner';

const TOKEN_HASH_PREFIX = '#session=';

/**
 * Ponto de retorno do fluxo OAuth.
 *
 * O token chega no FRAGMENTO da URL (`#session=...`), nunca visto pelo
 * servidor - nem no redirecionamento da API, nem em log de acesso. Lemos e
 * removemos da barra de enderecos imediatamente, e trocamos pela sessao com
 * um `fetch` comum: diferente de gravar o cookie na propria resposta do
 * redirecionamento, isso nao esbarra no limite que o Safari impoe a cookies
 * gravados logo apos uma navegacao vinda de outro site (o Google).
 *
 * O access token em si nunca aparece na URL, em nenhum dos dois casos - isso
 * o exporia no historico do navegador, nos logs de acesso e no header Referer.
 */
function AuthCallbackContent() {
  const { applySession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const hash = window.location.hash;
    const token = hash.startsWith(TOKEN_HASH_PREFIX)
      ? decodeURIComponent(hash.slice(TOKEN_HASH_PREFIX.length))
      : null;

    // Some da URL e do historico assim que lido, com ou sem sucesso.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (!token) {
      router.replace('/login?error=falha_login');
      return;
    }

    void (async () => {
      try {
        const session = await authService.exchangeSession(token);
        applySession(session);

        // Autorizacao incremental parte de Configuracoes -> Integracoes/Conta e volta para la.
        const destino = searchParams.get('destino');
        const conectado = searchParams.get('conectado');
        const vinculado = searchParams.get('vinculado');

        if (destino === 'integracoes') {
          router.replace(`/configuracoes?tab=integracoes&conectado=${conectado ?? 'classroom'}`);
          return;
        }

        if (destino === 'conta') {
          router.replace(`/configuracoes?tab=conta&vinculado=${vinculado ?? 'google'}`);
          return;
        }

        router.replace('/dashboard');
      } catch {
        router.replace('/login?error=falha_login');
      }
    })();
  }, [router, searchParams, applySession]);

  return <FullPageSpinner label="Concluindo login" />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageSpinner label="Concluindo login" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
