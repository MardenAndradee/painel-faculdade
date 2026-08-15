import { describe, expect, it } from 'vitest';
import { isPersistableQueryKey } from './query-persistence';

/**
 * Rede de segurança do risco R9 do plano de PWA: notas, boletim,
 * estatísticas e histórico nunca podem ir para o disco. Lista de permissão,
 * não de bloqueio - qualquer prefixo não listado explicitamente fica de fora.
 */
describe('isPersistableQueryKey', () => {
  it('permite os prefixos da lista de permissão', () => {
    expect(isPersistableQueryKey(['subjects'])).toBe(true);
    expect(isPersistableQueryKey(['exams', 'list', { semesterId: '1' }])).toBe(true);
    expect(isPersistableQueryKey(['assignments'])).toBe(true);
    expect(isPersistableQueryKey(['calendar', 'events'])).toBe(true);
  });

  it('bloqueia dado sensível mesmo com chave parecida', () => {
    expect(isPersistableQueryKey(['grades'])).toBe(false);
    expect(isPersistableQueryKey(['statistics'])).toBe(false);
    expect(isPersistableQueryKey(['semesters'])).toBe(false);
    expect(isPersistableQueryKey(['history'])).toBe(false);
  });

  it('bloqueia chave vazia ou com primeiro elemento não-string', () => {
    expect(isPersistableQueryKey([])).toBe(false);
    expect(isPersistableQueryKey([{ nested: true } as unknown as string])).toBe(false);
  });

  it('não casa por substring - só o prefixo exato', () => {
    // "subjects-extra" nao e "subjects": um prefixo por igualdade estrita,
    // nao por `startsWith`, evita que uma chave nova e nao revisada
    // acidentalmente calhe de comecar com um prefixo permitido.
    expect(isPersistableQueryKey(['subjects-extra'])).toBe(false);
  });
});
