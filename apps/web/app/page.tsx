'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { FullPageSpinner } from '@/components/ui/spinner';

/**
 * Raiz da aplicacao: encaminha para o dashboard ou para o login conforme a
 * sessao restaurada pelo AuthProvider.
 */
export default function HomePage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isLoading, isAuthenticated, router]);

  return <FullPageSpinner />;
}
