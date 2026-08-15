import { describe, expect, it } from 'vitest';
import { NetworkOnly } from 'serwist';
import { runtimeCaching } from './sw-runtime-caching';

/**
 * Rede de segurança do risco R1 do plano de PWA: nenhuma resposta de `/api/`
 * pode entrar em Cache Storage, em hipótese nenhuma - é o que separa o
 * cache de assets estáticos (seguro) do vazamento de dado autenticado
 * (inaceitável). Roda em CI, sem precisar de um Service Worker real ou de
 * um navegador - `runtimeCaching` é TypeScript comum, sem globais de Worker.
 */
describe('guarda de /api/ no Service Worker', () => {
  it('a PRIMEIRA regra da lista casa qualquer caminho /api/ same-origin', () => {
    // A ordem importa: rotas sao avaliadas em sequencia, a primeira que
    // casar vence. Uma regra de guarda no meio da lista nao protegeria
    // contra uma regra mais ampla registrada antes dela.
    const guard = runtimeCaching[0];

    expect(guard).toBeDefined();
    expect(typeof guard!.matcher).toBe('function');

    const matcher = guard!.matcher as (options: { sameOrigin: boolean; url: URL }) => boolean;

    expect(matcher({ sameOrigin: true, url: new URL('https://x.com/api/v1/notas') })).toBe(true);
    expect(matcher({ sameOrigin: true, url: new URL('https://x.com/api/v1/auth/login') })).toBe(
      true,
    );
  });

  it('a guarda usa NetworkOnly - nunca grava em cache, em nenhuma circunstância', () => {
    const guard = runtimeCaching[0];

    expect(guard!.handler).toBeInstanceOf(NetworkOnly);
  });

  it('a guarda não casa caminhos que só começam parecido com /api', () => {
    // "/apice" nao e "/api/" - `startsWith` exige a barra completa.
    const matcher = runtimeCaching[0]!.matcher as (options: {
      sameOrigin: boolean;
      url: URL;
    }) => boolean;

    expect(matcher({ sameOrigin: true, url: new URL('https://x.com/apice/coisa') })).toBe(false);
  });

  it('a guarda não casa /api/ de outra origem (cross-origin já não seria same-origin de verdade)', () => {
    const matcher = runtimeCaching[0]!.matcher as (options: {
      sameOrigin: boolean;
      url: URL;
    }) => boolean;

    expect(matcher({ sameOrigin: false, url: new URL('https://outra-origem.com/api/x') })).toBe(
      false,
    );
  });

  it('nenhuma regra usa um nome de cache que sugira guardar resposta de API', () => {
    // Trava contra o erro que motivou este teste: `defaultCache` do
    // @serwist/next/worker tem uma regra "apis" (NetworkFirst, 24h) para
    // qualquer /api/ same-origin - exatamente o que este projeto nao pode
    // ter, ja que a API real fica atras do mesmo dominio via rewrite da
    // Vercel.
    const cacheNames = runtimeCaching
      .map((entry) => (entry.handler as { cacheName?: string }).cacheName)
      .filter((name): name is string => Boolean(name));

    expect(cacheNames).not.toContain('apis');
  });
});
