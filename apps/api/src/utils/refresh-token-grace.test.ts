import { describe, expect, it } from 'vitest';
import { isWithinReuseGrace } from './refresh-token-grace.js';

/**
 * Borda medida a partir do `revokedAt` original - ver
 * docs/planning/refresh-token-grace-period.md, Etapa 33.1.
 */

describe('isWithinReuseGrace', () => {
  const revokedAt = new Date('2026-01-01T12:00:00.000Z');
  const graceMs = 30_000;

  it('perdoa reaparecimento bem dentro da janela (5s depois)', () => {
    const now = new Date(revokedAt.getTime() + 5_000);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(true);
  });

  it('perdoa exatamente no limite da janela (29.9s depois)', () => {
    const now = new Date(revokedAt.getTime() + 29_900);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(true);
  });

  it('nao perdoa logo apos o limite da janela (30.1s depois)', () => {
    const now = new Date(revokedAt.getTime() + 30_100);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(false);
  });

  it('perdoa no limite exato (30s depois, inclusive)', () => {
    const now = new Date(revokedAt.getTime() + 30_000);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(true);
  });

  it('nao perdoa muito depois da janela (40s depois)', () => {
    const now = new Date(revokedAt.getTime() + 40_000);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(false);
  });

  it('perdoa quando "agora" e anterior a revogacao (elapsed negativo, sem risco adicional)', () => {
    const now = new Date(revokedAt.getTime() - 1_000);

    expect(isWithinReuseGrace(revokedAt, now, graceMs)).toBe(true);
  });
});
