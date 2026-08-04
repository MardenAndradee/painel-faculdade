import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import type { StorageProvider } from './types.js';

/**
 * Storage no Cloudflare R2, via API compativel com S3.
 *
 * Necessario em producao na Vercel: funcoes serverless nao tem disco
 * persistente entre invocacoes, entao os blobs de anexos precisam morar em
 * object storage. R2 foi escolhido em vez de S3 pelo egress gratuito - o
 * custo de baixar materiais nunca cresce com o uso.
 */
export function createR2StorageProvider(): StorageProvider {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const bucket = env.R2_BUCKET_NAME;

  return {
    async save(key, buffer) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer }));
    },

    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async removeMany(keys) {
      if (keys.length === 0) return;

      // A API de exclusao em lote aceita no maximo 1000 chaves por chamada.
      for (let offset = 0; offset < keys.length; offset += 1000) {
        const batch = keys.slice(offset, offset + 1000);

        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          }),
        );
      }
    },

    async createReadStream(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

      // No runtime Node.js o SDK sempre devolve um Readable; as demais opcoes
      // do tipo (Blob, ReadableStream web) so se aplicam a runtimes de edge/browser.
      return result.Body as Readable;
    },
  };
}
