'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@painel/shared';
import { authService } from '@/services/auth.service';
import { setAccessToken, setSessionExpiredHandler } from '@/services/http-client';

/**
 * Estado global de autenticacao.
 *
 * O access token vive em memoria no modulo do http-client; aqui guardamos
 * apenas o usuario e o estado de carregamento. Ao montar, tentamos restaurar a
 * sessao pelo cookie httpOnly - por isso um recarregamento nao desloga.
 */

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (scopes?: 'classroom' | 'calendar') => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * Renovacao proativa agendada para pouco antes do token expirar, evitando
   * que o usuario tope com um 401 no meio de uma acao.
   */
  const renewalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Referencia a rotina de renovacao.
   *
   * O agendamento e a rotina se chamam mutuamente; o ref quebra esse ciclo sem
   * recriar o timer a cada render.
   */
  const restoreSessionRef = useRef<() => Promise<void>>(async () => {});

  const clearRenewalTimer = useCallback(() => {
    if (renewalTimer.current) {
      clearTimeout(renewalTimer.current);
      renewalTimer.current = null;
    }
  }, []);

  const scheduleRenewal = useCallback(
    (expiresIn: number) => {
      clearRenewalTimer();

      // Renova 1 minuto antes de expirar (nunca menos que 10 segundos).
      const delay = Math.max((expiresIn - 60) * 1000, 10_000);

      renewalTimer.current = setTimeout(() => {
        void restoreSessionRef.current();
      }, delay);
    },
    [clearRenewalTimer],
  );

  const restoreSession = useCallback(async (): Promise<void> => {
    try {
      const session = await authService.refresh();

      setUserState(session.user);
      scheduleRenewal(session.expiresIn);
    } catch {
      setUserState(null);
      setAccessToken(null);
      clearRenewalTimer();
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRenewal, clearRenewalTimer]);

  useEffect(() => {
    restoreSessionRef.current = restoreSession;
  }, [restoreSession]);

  useEffect(() => {
    void restoreSessionRef.current();

    return clearRenewalTimer;
  }, [clearRenewalTimer]);

  const logout = useCallback(async (): Promise<void> => {
    clearRenewalTimer();
    await authService.logout();

    setUserState(null);
    router.replace('/login');
  }, [router, clearRenewalTimer]);

  // Quando a renovacao falha em definitivo, o http-client avisa por aqui.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearRenewalTimer();
      setUserState(null);
      router.replace('/login?error=sessao_expirada');
    });

    return () => setSessionExpiredHandler(null);
  }, [router, clearRenewalTimer]);

  const refreshUser = useCallback(async (): Promise<void> => {
    const current = await authService.me();
    setUserState(current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login: (scopes) => authService.redirectToGoogle(scopes),
      logout,
      refreshUser,
      setUser: setUserState,
    }),
    [user, isLoading, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
