import { env } from '../config/env.js';
import { createLocalStorageProvider } from './local.js';
import { createR2StorageProvider } from './r2.js';
import type { StorageProvider } from './types.js';

/** Provider ativo, escolhido por `STORAGE_DRIVER`. Ver `types.ts`. */
export const storage: StorageProvider =
  env.STORAGE_DRIVER === 'r2' ? createR2StorageProvider() : createLocalStorageProvider();

export type { StorageProvider };
