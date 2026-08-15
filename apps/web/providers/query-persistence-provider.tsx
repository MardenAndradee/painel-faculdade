'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';
import { useAuth } from '@/hooks/use-auth';
import {
  clearPersistedQueryCache,
  createUserPersister,
  isPersistableQueryKey,
  PERSISTED_CACHE_MAX_AGE_MS,
} from '@/lib/query-persistence';

/**
 * Restaura e mantém em disco (IndexedDB) o cache de queries da lista de
 * permissão (Etapa 28.6) - disciplinas, provas, atividades e calendário.
 *
 * Vive dentro do AuthProvider (precisa de `user.id` para o namespace por
 * usuário) e dentro do QueryProvider (precisa do QueryClient). Não renderiza
 * nada por si só - é só um efeito colateral ligado ao ciclo de vida da sessão.
 */
export function QueryPersistenceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const previousId = previousUserId.current;
    const currentId = user?.id ?? null;

    previousUserId.current = currentId;

    // Logout ou troca de conta no mesmo aparelho: o que ficou gravado do
    // usuário anterior não deve sobreviver, mesmo sem passar pelo fluxo
    // explícito de logout (ex.: sessão expirada em outra aba).
    if (previousId && previousId !== currentId) {
      void clearPersistedQueryCache(previousId);
    }

    if (!currentId) return;

    const persister = createUserPersister(currentId);
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void persistQueryClientRestore({
      queryClient,
      persister,
      maxAge: PERSISTED_CACHE_MAX_AGE_MS,
    }).then(() => {
      // O componente pode ter desmontado (ou o usuário trocado de novo)
      // enquanto a restauração, assíncrona, ainda estava em andamento.
      if (cancelled) return;

      unsubscribe = persistQueryClientSubscribe({
        queryClient,
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => isPersistableQueryKey(query.queryKey),
        },
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, queryClient]);

  return children;
}
