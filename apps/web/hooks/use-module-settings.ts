'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AppModule } from '@painel/shared';
import { moduleSettingsService } from '@/services/module-settings.service';
import { ApiError } from '@/services/http-client';
import { MODULE_DEFINITIONS } from '@/lib/modules';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de Módulos Configuráveis (Etapa 29).
 *
 * `useIsModuleEnabled` é o ponto único que a Sidebar, o Dashboard, a guarda
 * de rota e qualquer tela nova deveriam consultar - evita `if` espalhado
 * (§21 do plano).
 */

export const moduleSettingsKeys = {
  all: ['module-settings'] as const,
};

export function useModuleSettings() {
  return useQuery({
    queryKey: moduleSettingsKeys.all,
    queryFn: () => moduleSettingsService.list(),
    // Muda raramente - staleTime alto evita refetch a cada navegacao, o que
    // faria a Sidebar "piscar" itens ao trocar de pagina.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * `true` enquanto a lista ainda não carregou - trata como ativado, nunca
 * esconde a UI num piscar por falta de dado.
 */
export function useIsModuleEnabled(module: AppModule): boolean {
  const { data } = useModuleSettings();

  if (!data) return true;

  return data.find((item) => item.module === module)?.enabled ?? true;
}

function blockedByMessage(modules: AppModule[]): string {
  const labels = modules.map((module) => MODULE_DEFINITIONS[module].label);
  const plural = labels.length > 1;

  return `${labels.join(', ')} ${plural ? 'dependem' : 'depende'} deste módulo. Desative ${plural ? 'esses módulos' : 'esse módulo'} primeiro.`;
}

function autoEnabledMessage(trigger: AppModule, autoEnabled: AppModule[]): string {
  const labels = autoEnabled.map((module) => MODULE_DEFINITIONS[module].label);
  const plural = labels.length > 1;

  return `${labels.join(', ')} ${plural ? 'foram ativados' : 'foi ativado'} junto, porque ${MODULE_DEFINITIONS[trigger].label} depende ${plural ? 'deles' : 'dele'}.`;
}

export function useUpdateModuleSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ module, enabled }: { module: AppModule; enabled: boolean }) =>
      moduleSettingsService.update(module, { enabled }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(moduleSettingsKeys.all, result.updated);

      if (result.autoEnabled.length > 0) {
        toast.info(autoEnabledMessage(variables.module, result.autoEnabled));
      }
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.details?.blockedBy) {
        toast.error(blockedByMessage(error.details.blockedBy as AppModule[]));
        return;
      }

      const moduleLabel = MODULE_DEFINITIONS[variables.module].label;
      toast.error(errorMessage(error, `Não foi possível atualizar ${moduleLabel}`));
    },
  });
}
