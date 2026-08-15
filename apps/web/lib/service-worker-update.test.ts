import { describe, expect, it } from 'vitest';
import { isGenuineUpdate } from './service-worker-update';

describe('isGenuineUpdate', () => {
  it('não avisa na primeira instalação (isUpdate ausente)', () => {
    expect(isGenuineUpdate({})).toBe(false);
  });

  it('não avisa quando isUpdate é explicitamente falso', () => {
    expect(isGenuineUpdate({ isUpdate: false })).toBe(false);
  });

  it('avisa quando isUpdate é verdadeiro', () => {
    expect(isGenuineUpdate({ isUpdate: true })).toBe(true);
  });
});
