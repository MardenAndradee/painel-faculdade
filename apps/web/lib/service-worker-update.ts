/**
 * Decide de aviso de atualização do Service Worker (Etapa 28.9).
 *
 * `waiting` do `@serwist/window` dispara tanto na primeira instalação (um SW
 * fica esperando por `clients.claim()`/`skipWaiting`) quanto numa atualização
 * de verdade. Só a segunda deve virar o toast "Nova versão disponível" -
 * mostrá-lo na primeira visita, antes de o usuário ter qualquer versão
 * anterior pra comparar, seria confuso.
 */
export function isGenuineUpdate(event: { isUpdate?: boolean }): boolean {
  return event.isUpdate === true;
}
