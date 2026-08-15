import { get, set, del } from 'idb-keyval';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';
import type { QueryKey } from '@tanstack/react-query';

/**
 * Persistência de prazos em IndexedDB (Etapa 28.6).
 *
 * LISTA DE PERMISSÃO explícita - nunca lista de bloqueio (risco R9 do
 * plano). Disciplinas, provas, atividades e calendário têm alto valor
 * offline e baixa sensibilidade. Notas, boletim, estatísticas e histórico
 * NUNCA entram aqui: alta sensibilidade ("ninguém quer que um amigo pegue o
 * celular emprestado e veja que reprovou"), baixo valor offline (nota não
 * muda de hora em hora). Uma chave de query nova só passa a ser persistida
 * se alguém adicionar o prefixo dela aqui, de propósito - o padrão é
 * NUNCA gravar em disco.
 */
const PERSISTABLE_QUERY_KEY_PREFIXES: ReadonlySet<string> = new Set([
  'subjects',
  'exams',
  'assignments',
  'calendar',
]);

/** Decide se uma query pode ir para o disco. Exportada para ser testável isoladamente. */
export function isPersistableQueryKey(queryKey: QueryKey): boolean {
  const prefix = queryKey[0];

  return typeof prefix === 'string' && PERSISTABLE_QUERY_KEY_PREFIXES.has(prefix);
}

/** Prazo máximo que um cache em disco é considerado válido - depois disso, descartado. */
export const PERSISTED_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storageKeyFor(userId: string): string {
  // A chave inteira e o namespace: cada usuario tem a sua propria entrada no
  // IndexedDB, entao nao ha o que "vazar" entre contas no mesmo aparelho -
  // restaurar para o usuario B nunca le a chave do usuario A, por construcao.
  return `painel-query-cache:${userId}`;
}

/** Persister por usuário, guardado no IndexedDB via idb-keyval. */
export function createUserPersister(userId: string): Persister {
  return createAsyncStoragePersister({
    key: storageKeyFor(userId),
    throttleTime: 3000,
    storage: {
      getItem: (key) => get(key),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
  });
}

/**
 * Apaga o cache em disco de um usuário - chamado no logout (Etapa 28.1/28.6).
 *
 * Zerar o `QueryClient` em memória (já feito no logout) não apaga o que já
 * foi escrito no IndexedDB; sem isso, o disco guardaria prazos de uma conta
 * encerrada indefinidamente.
 */
export async function clearPersistedQueryCache(userId: string): Promise<void> {
  await del(storageKeyFor(userId));
}
