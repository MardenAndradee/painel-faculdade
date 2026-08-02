import { ApiError } from '@/services/http-client';

/**
 * Mensagem de erro para exibir ao usuario.
 *
 * A mensagem do servidor vem primeiro porque ela e especifica ("O arquivo
 * excede o limite de 25 MB"); o texto de reserva so aparece quando a falha nao
 * veio da API - queda de rede, por exemplo. Trocar a ordem transformaria todo
 * erro num generico "nao foi possivel salvar".
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.firstDetail ?? error.message;

  return fallback;
}
