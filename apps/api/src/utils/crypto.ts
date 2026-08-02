import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hash SHA-256 em hexadecimal.
 *
 * Usado para refresh tokens: o banco guarda apenas o hash, entao um dump do
 * banco nao permite assumir sessoes. Nao usamos bcrypt/argon2 aqui porque o
 * token ja e um valor aleatorio de alta entropia - o custo de KDF so faz
 * sentido contra segredos de baixa entropia, como senhas.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** String aleatoria segura, usada no parametro `state` do OAuth. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Comparacao em tempo constante.
 *
 * Impede que um atacante deduza o valor correto medindo quanto tempo a
 * comparacao leva ate divergir.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}
