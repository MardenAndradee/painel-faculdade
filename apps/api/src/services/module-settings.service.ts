import {
  APP_MODULES,
  MODULE_DEFAULT_ENABLED,
  MODULE_DEPENDENCIES,
  type AppModule,
  type ModuleSettingItem,
  type UpdateModuleSettingResult,
} from '@painel/shared';
import { moduleSettingsRepository } from '../repositories/module-settings.repository.js';
import { AppError } from '../utils/app-error.js';

/**
 * Regra de negócio de Módulos Configuráveis (Etapa 29).
 *
 * Tabela esparsa: uma linha em `UserModuleSetting` só existe quando o
 * usuário desvia do padrão (`MODULE_DEFAULT_ENABLED`) - ausência de linha
 * já significa o padrão. Ver docs/planning/modulos-configuraveis.md.
 */

/** Todas as dependências de um módulo, incluindo as das próprias dependências. */
function transitiveDependencies(module: AppModule): Set<AppModule> {
  const result = new Set<AppModule>();
  const stack = [...MODULE_DEPENDENCIES[module]];

  while (stack.length > 0) {
    const dep = stack.pop() as AppModule;

    if (result.has(dep)) continue;

    result.add(dep);
    stack.push(...MODULE_DEPENDENCIES[dep]);
  }

  return result;
}

/** Todo módulo que depende (direta ou transitivamente) do módulo dado. */
function modulesThatDependOn(module: AppModule): AppModule[] {
  return APP_MODULES.filter((candidate) => transitiveDependencies(candidate).has(module));
}

async function getEnabledMap(userId: string): Promise<Record<AppModule, boolean>> {
  const rows = await moduleSettingsRepository.findAllByUserId(userId);
  const overrides = new Map(rows.map((row) => [row.module, row.enabled]));

  return Object.fromEntries(
    APP_MODULES.map((module) => [module, overrides.get(module) ?? MODULE_DEFAULT_ENABLED[module]]),
  ) as Record<AppModule, boolean>;
}

export const moduleSettingsService = {
  async list(userId: string): Promise<ModuleSettingItem[]> {
    const map = await getEnabledMap(userId);

    return APP_MODULES.map((module) => ({ module, enabled: map[module] }));
  },

  /** Usado por outros serviços (busca, notificações) para filtrar pelo que está ativo. */
  async getEnabledSet(userId: string): Promise<Set<AppModule>> {
    const map = await getEnabledMap(userId);

    return new Set(APP_MODULES.filter((module) => map[module]));
  },

  /**
   * Ativar propaga pra cima (ativa as dependências junto, avisando via
   * `autoEnabled`); desativar bloqueia se algum módulo ativo depender deste -
   * nunca desativa em cascata. Ver §7/§29 do plano.
   */
  async update(
    userId: string,
    module: AppModule,
    enabled: boolean,
  ): Promise<UpdateModuleSettingResult> {
    const map = await getEnabledMap(userId);

    if (enabled) {
      const missingDependencies = [...transitiveDependencies(module)].filter((dep) => !map[dep]);

      await moduleSettingsRepository.upsertMany(userId, [module, ...missingDependencies], true);

      return { updated: await this.list(userId), autoEnabled: missingDependencies };
    }

    const blockedBy = modulesThatDependOn(module).filter((dependent) => map[dependent]);

    if (blockedBy.length > 0) {
      throw AppError.conflict('Outros módulos ativos dependem deste - desative-os primeiro.', {
        blockedBy,
      });
    }

    await moduleSettingsRepository.upsertMany(userId, [module], false);

    return { updated: await this.list(userId), autoEnabled: [] };
  },
};
