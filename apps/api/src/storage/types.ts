import type { Readable } from 'node:stream';

/**
 * Onde os bytes de um anexo moram, escondido da camada de negocio.
 *
 * `attachment.service.ts` conhece so esta interface - trocar o provider
 * (local, R2, S3...) e escrever uma nova implementacao aqui. Service,
 * controller e rota ficam intactos.
 */
export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<void>;
  remove(key: string): Promise<void>;
  removeMany(keys: string[]): Promise<void>;
  createReadStream(key: string): Promise<Readable>;
}
