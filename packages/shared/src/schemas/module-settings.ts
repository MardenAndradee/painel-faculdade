import { z } from 'zod';
import { APP_MODULES, type AppModule } from '../enums.js';

/**
 * Contrato de Módulos Configuráveis (Etapa 29).
 *
 * Rótulo, descrição e ícone de cada módulo moram só em
 * `apps/web/lib/modules.ts` - o backend nunca precisa deles, só das chaves e
 * das regras abaixo. Ver docs/planning/modulos-configuraveis.md.
 */

/**
 * Padrão de cada módulo para quem não tem linha em `UserModuleSetting`.
 *
 * Único desvio de "tudo ativado" é `FLASHCARDS`: já estava fora da
 * navegação por uma decisão anterior (redesenho visual pendente) - o padrão
 * preserva essa experiência em vez de reintroduzir o módulo sem pedido.
 */
export const MODULE_DEFAULT_ENABLED: Record<AppModule, boolean> = {
  SUBJECTS: true,
  ASSIGNMENTS: true,
  EXAMS: true,
  CALENDAR: true,
  GRADES: true,
  HISTORY: true,
  MATERIALS: true,
  FLASHCARDS: false,
  STUDY_PLAN: true,
  EXAM_PREP: true,
  STATISTICS: true,
  CLASSES: true,
};

/**
 * Dependências de cada módulo. Ativar um módulo ativa as dependências junto
 * (com aviso); desativar um módulo que outro módulo ativo depende dele é
 * bloqueado - nunca desativa em cascata.
 */
export const MODULE_DEPENDENCIES: Record<AppModule, AppModule[]> = {
  SUBJECTS: [],
  ASSIGNMENTS: [],
  EXAMS: [],
  CALENDAR: [],
  GRADES: ['SUBJECTS'],
  HISTORY: ['GRADES'],
  MATERIALS: [],
  FLASHCARDS: [],
  STUDY_PLAN: [],
  EXAM_PREP: ['EXAMS'],
  STATISTICS: [],
  CLASSES: ['SUBJECTS', 'ASSIGNMENTS', 'EXAMS', 'CALENDAR'],
};

export const updateModuleSettingSchema = z.object({
  enabled: z.boolean({ error: 'Informe se o módulo deve ficar ativado' }),
});

export type UpdateModuleSettingInput = z.infer<typeof updateModuleSettingSchema>;

export const moduleParamSchema = z.object({
  module: z.enum(APP_MODULES, { error: 'Módulo inválido' }),
});

export interface ModuleSettingItem {
  module: AppModule;
  enabled: boolean;
}

/**
 * Resposta de `PATCH /module-settings/:module` ao ativar. `autoEnabled` lista
 * as dependências que foram ativadas junto, para a interface avisar o
 * motivo - nunca vem preenchido numa desativação (que bloqueia, não propaga).
 */
export interface UpdateModuleSettingResult {
  updated: ModuleSettingItem[];
  autoEnabled: AppModule[];
}
