'use client';

import { useContext } from 'react';
import { AuthContext } from '@/providers/auth-provider';

/**
 * Acesso ao estado de autenticacao.
 *
 * Lanca se usado fora do AuthProvider: melhor falhar alto no desenvolvimento
 * do que devolver `user: null` e simular um usuario deslogado.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }

  return context;
}
