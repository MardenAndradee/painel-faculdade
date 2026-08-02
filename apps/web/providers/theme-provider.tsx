'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Tema claro/escuro.
 *
 * `attribute="class"` aplica a classe `.dark` no <html>, que e exatamente o
 * seletor esperado pelo `@custom-variant dark` definido em globals.css.
 *
 * O next-themes injeta um script inline que roda antes da pintura: sem ele, o
 * usuario com tema escuro veria um flash branco a cada carregamento.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
