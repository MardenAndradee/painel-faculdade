import argon2 from 'argon2';

/**
 * Hash de senha (Etapa 26 - autenticacao e-mail+senha).
 *
 * `argon2id` e a recomendacao atual do OWASP para hash de senha - hibrido
 * entre `argon2i` (resistente a ataque por canal lateral) e `argon2d`
 * (resistente a GPU/ASIC). Diferente de `hashToken` em `crypto.ts`: aquele e
 * SHA-256 puro, adequado para valores ja aleatorios de alta entropia (tokens);
 * senha e escolhida por humano e de baixa entropia, entao precisa de um KDF
 * deliberadamente lento para tornar forca bruta cara.
 *
 * Os parametros (memoria/tempo/paralelismo) ficam nos DEFAULTS da biblioteca
 * - eles ja seguem a recomendacao do OWASP e mudam de versao em versao
 * conforme hardware fica mais rapido; fixar valores aqui congelaria o projeto
 * num parametro que envelhece.
 */

const HASH_OPTIONS = { type: argon2.argon2id } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

/**
 * Compara em tempo do proprio argon2 (ja resistente a timing attack por
 * natureza do algoritmo - nao precisa de `safeCompare` por cima).
 */
export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false);
}
