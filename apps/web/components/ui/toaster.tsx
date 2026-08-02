'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

/**
 * Notificacoes de acao (sonner).
 *
 * Recebe o tema resolvido do next-themes para que os toasts acompanhem o modo
 * claro/escuro em vez de manterem o proprio esquema de cores.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border shadow-md',
        },
      }}
    />
  );
}
