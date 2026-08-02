'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { FullPageSpinner } from '@/components/ui/spinner';

/**
 * Bloqueia o conteudo ate que a sessao seja confirmada.
 *
 * Envolve os grupos de rota autenticados. Enquanto a restauracao da sessao
 * acontece exibe o spinner - sem isso, a tela piscaria conteudo protegido
 * antes de redirecionar o visitante nao autenticado.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <FullPageSpinner label="Verificando sessao" />;
  }

  if (!isAuthenticated) {
    return <FullPageSpinner label="Redirecionando para o login" />;
  }

  return <>{children}</>;
}
