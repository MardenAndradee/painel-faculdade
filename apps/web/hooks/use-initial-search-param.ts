'use client';

import { useEffect, useState } from 'react';

/**
 * Le um parametro da URL uma unica vez, na montagem (Etapa 19).
 *
 * Serve para a busca global abrir uma listagem ja filtrada no item escolhido
 * (`/atividades?busca=Lista 3`), garantindo que ele esteja visivel em vez de
 * perdido na pagina 4.
 *
 * Deliberadamente NAO usa `useSearchParams`: em telas pre-renderizadas o Next
 * exige envolve-las num `Suspense` e tira a pagina do prerender estatico -
 * custo real para ler um parametro opcional que muda apenas quando a URL muda,
 * e nesse caso a tela remonta de qualquer forma.
 *
 * A leitura acontece em efeito, e nao no inicializador do `useState`, para nao
 * criar divergencia de hidratacao: no servidor nao existe `window`, e o
 * primeiro render precisa ser igual dos dois lados.
 */
export function useInitialSearchParam(name: string): string {
  const [value, setValue] = useState('');

  useEffect(() => {
    const found = new URLSearchParams(window.location.search).get(name);

    if (found) setValue(found);
  }, [name]);

  return value;
}
