'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UpdateProfileInput } from '@painel/shared';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';
import { useAuth } from './use-auth';

/**
 * Atualiza o perfil (nome/tema/fuso) e reflete o resultado no `AuthContext`
 * na hora - sem isso, o dropdown de tema em outra tela ficaria mostrando o
 * valor antigo até um refresh.
 */
export function useUpdateProfile() {
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) => authService.updateProfile(data),
    onSuccess: (user) => setUser(user),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar a preferência')),
  });
}
