'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ChangePasswordInput, SetPasswordInput } from '@painel/shared';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de métodos de login da conta (Etapa 26 - Configurações → Conta). */

export const loginMethodsKeys = {
  all: ['login-methods'] as const,
};

export function useLoginMethods() {
  return useQuery({
    queryKey: loginMethodsKeys.all,
    queryFn: () => authService.getLoginMethods(),
  });
}

/** Vinculo do Google (Fluxo 5): pede a URL e navega - a resposta real chega pelo callback. */
export function useStartGoogleLink() {
  return useMutation({
    mutationFn: () => authService.startGoogleLink(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível iniciar o vínculo')),
  });
}

export function useUnlinkGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.unlinkGoogle(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: loginMethodsKeys.all });
      toast.success('Google desvinculado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível desvincular')),
  });
}

export function useSetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetPasswordInput) => authService.setPassword(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: loginMethodsKeys.all });
      toast.success('Senha definida');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível definir a senha')),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) => authService.changePassword(data),
    onSuccess: () => toast.success('Senha alterada'),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível alterar a senha')),
  });
}
