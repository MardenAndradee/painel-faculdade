import { describe, expect, it } from 'vitest';
import { toNextTheme, toThemePreference } from './theme-preference';

describe('toThemePreference', () => {
  it('converte cada valor do next-themes para o formato do backend', () => {
    expect(toThemePreference('light')).toBe('LIGHT');
    expect(toThemePreference('dark')).toBe('DARK');
    expect(toThemePreference('system')).toBe('SYSTEM');
  });
});

describe('toNextTheme', () => {
  it('converte cada valor do backend para o formato do next-themes', () => {
    expect(toNextTheme('LIGHT')).toBe('light');
    expect(toNextTheme('DARK')).toBe('dark');
    expect(toNextTheme('SYSTEM')).toBe('system');
  });

  it('é a inversa exata de toThemePreference para os três valores', () => {
    const values: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

    for (const value of values) {
      expect(toNextTheme(toThemePreference(value))).toBe(value);
    }
  });
});
