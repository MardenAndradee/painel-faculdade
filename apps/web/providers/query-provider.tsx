'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/services/http-client';

/**
 * Configuracao do TanStack Query.
 *
 * O QueryClient e criado dentro de estado (e nao no escopo do modulo) para que
 * cada usuario tenha o seu: no App Router o modulo e compartilhado entre
 * requisicoes no servidor, e um client global vazaria cache entre pessoas.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Erros de autenticacao, permissao ou validacao nao melhoram com
              // nova tentativa - o http-client ja cuidou da renovacao.
              if (error instanceof ApiError && error.status < 500) return false;

              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
