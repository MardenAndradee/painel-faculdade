'use client';

import { useQuery } from '@tanstack/react-query';
import type { SearchResults } from '@painel/shared';
import { searchService } from '@/services/search.service';
import { useDebouncedValue } from './use-debounced-value';

/**
 * Busca global (Etapa 19).
 *
 * Isolado num arquivo proprio de proposito: a paleta de comando so consome
 * `{ results, isLoading, term }`, entao trocar a fonte no futuro - um indice
 * dedicado, por exemplo - nao exige tocar no componente visual.
 *
 * O termo e debounced aqui, e nao no componente, para que qualquer consumidor
 * herde o mesmo comportamento sem repetir a decisao.
 */

export const searchKeys = {
  query: (term: string) => ['search', term] as const,
};

/** Abaixo disso a busca traria quase tudo - nao e um resultado util. */
const MIN_LENGTH = 2;

export function useGlobalSearch(input: string): {
  results: SearchResults | undefined;
  isLoading: boolean;
  /** O termo efetivamente consultado, para destacar nos resultados. */
  term: string;
  isTooShort: boolean;
} {
  const term = useDebouncedValue(input.trim());
  const enabled = term.length >= MIN_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: searchKeys.query(term),
    queryFn: () => searchService.search(term),
    enabled,
    // O mesmo termo digitado de novo em segundos nao precisa ir ao servidor.
    staleTime: 30 * 1000,
  });

  return {
    results: enabled ? data : undefined,
    // `isFetching` e nao `isLoading`: trocar de termo com cache antigo em mao
    // tambem e carregamento, do ponto de vista de quem esta digitando.
    isLoading: enabled && isFetching,
    term,
    isTooShort: input.trim().length > 0 && !enabled,
  };
}
