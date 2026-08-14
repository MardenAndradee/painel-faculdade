'use client';

import { MODULE_DEFINITIONS, MODULE_DISPLAY_ORDER } from '@/lib/modules';
import { useModuleSettings, useUpdateModuleSetting } from '@/hooks/use-module-settings';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Configurações → Módulos (Etapa 29.4).
 *
 * Desativar um módulo nunca apaga dado nenhum - só tira da Sidebar,
 * Dashboard, busca e notificações. Ver docs/planning/modulos-configuraveis.md.
 */
export function ModuleSettingsPanel() {
  const { data, isLoading } = useModuleSettings();
  const update = useUpdateModuleSetting();

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  const enabledByModule = new Map(data.map((item) => [item.module, item.enabled]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Desativar um módulo só tira ele da experiência principal — nenhum dado é apagado, e reativar
        traz tudo de volta exatamente como estava.
      </p>

      <Card className="divide-y p-0">
        {MODULE_DISPLAY_ORDER.map((module) => {
          const definition = MODULE_DEFINITIONS[module];
          const Icon = definition.icon;
          const enabled = enabledByModule.get(module) ?? true;
          const isPending = update.isPending && update.variables?.module === module;

          return (
            <div key={module} className="flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4.5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{definition.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{definition.description}</p>
              </div>

              <Switch
                checked={enabled}
                disabled={isPending}
                onCheckedChange={(checked) => update.mutate({ module, enabled: checked })}
                aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${definition.label}`}
              />
            </div>
          );
        })}
      </Card>
    </div>
  );
}
