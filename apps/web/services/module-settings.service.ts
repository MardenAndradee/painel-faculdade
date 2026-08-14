import type {
  AppModule,
  ModuleSettingItem,
  UpdateModuleSettingInput,
  UpdateModuleSettingResult,
} from '@painel/shared';
import { httpClient } from './http-client';

export const moduleSettingsService = {
  list(): Promise<ModuleSettingItem[]> {
    return httpClient.get<ModuleSettingItem[]>('/module-settings');
  },

  update(module: AppModule, data: UpdateModuleSettingInput): Promise<UpdateModuleSettingResult> {
    return httpClient.patch<UpdateModuleSettingResult>(`/module-settings/${module}`, data);
  },
};
