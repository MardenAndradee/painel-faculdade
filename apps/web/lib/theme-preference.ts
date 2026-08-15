import type { ThemePreference } from '@painel/shared';

/**
 * Conversão entre o formato do `next-themes` (minúsculo, só client-side) e o
 * `ThemePreference` do backend (Etapa 28.12) - dois vocabulários para a
 * mesma escolha, cada um herdado de uma biblioteca diferente.
 */
export type NextTheme = 'light' | 'dark' | 'system';

export function toThemePreference(theme: NextTheme): ThemePreference {
  switch (theme) {
    case 'light':
      return 'LIGHT';
    case 'dark':
      return 'DARK';
    default:
      return 'SYSTEM';
  }
}

export function toNextTheme(theme: ThemePreference): NextTheme {
  switch (theme) {
    case 'LIGHT':
      return 'light';
    case 'DARK':
      return 'dark';
    default:
      return 'system';
  }
}
