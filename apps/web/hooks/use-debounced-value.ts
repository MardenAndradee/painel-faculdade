'use client';

import { useEffect, useState } from 'react';

/**
 * Adia a propagacao de um valor que muda rapido.
 *
 * Usado na busca: sem isso, cada tecla digitada dispararia uma requisicao.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
