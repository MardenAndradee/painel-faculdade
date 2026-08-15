'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';
import { toNextTheme } from '@/lib/theme-preference';

/**
 * Sincroniza o tema salvo no servidor ao logar num aparelho novo (Etapa
 * 28.12) - hoje o `next-themes` só persiste em `localStorage`, por isso a
 * escolha "não sobrevive a trocar de aparelho".
 *
 * Aplicado UMA vez por usuário carregado, nunca de novo depois disso: uma
 * mudança de tema local é o que deve mandar dali em diante (e é ela quem
 * empurra para o servidor, via `useUpdateProfile`) - reaplicar o valor do
 * servidor a cada render desfaria uma troca feita na hora, na própria tela
 * de Preferências.
 */
export function ThemeSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return;

    syncedUserId.current = user.id;
    setTheme(toNextTheme(user.theme));
  }, [user, setTheme]);

  return children;
}
