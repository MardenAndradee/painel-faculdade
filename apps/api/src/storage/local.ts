import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../config/env.js';
import type { StorageProvider } from './types.js';

/**
 * Storage local em disco, sob `UPLOAD_DIR`.
 *
 * So funciona onde o processo tem disco persistente entre requisicoes (dev
 * local, Docker com volume). Em funcoes serverless (Vercel) o filesystem e
 * efemero por invocacao - la o driver precisa ser `r2`.
 *
 * As chaves sao sempre geradas pelo backend (ver `buildStorageKey` em
 * attachment.service.ts), nunca a partir de nome de arquivo do usuario. Ainda
 * assim resolvemos e conferimos que o caminho final fica dentro da raiz antes
 * de tocar o disco, como segunda camada contra path traversal.
 */
export function createLocalStorageProvider(): StorageProvider {
  const root = resolve(env.UPLOAD_DIR);

  function resolveKeyPath(key: string): string {
    const target = resolve(root, key);

    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`Chave de storage fora da raiz permitida: ${key}`);
    }

    return target;
  }

  async function remove(key: string): Promise<void> {
    await rm(resolveKeyPath(key), { force: true });
  }

  return {
    async save(key, buffer) {
      const path = resolveKeyPath(key);

      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, buffer);
    },

    remove,

    async removeMany(keys) {
      await Promise.all(keys.map((key) => remove(key)));
    },

    async createReadStream(key) {
      return createReadStream(resolveKeyPath(key));
    },
  };
}
