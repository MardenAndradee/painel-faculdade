import { WebPushError } from 'web-push';

/**
 * Decide se uma falha de envio (Etapa 28.11, risco R8) significa que a
 * inscrição está morta e deve ser apagada. `404`/`410` são os códigos que o
 * provedor de push devolve quando o navegador desinstalou o app ou revogou a
 * permissão - qualquer outro código (rede instável, 5xx temporário) não deve
 * apagar a inscrição, só logar e tentar de novo no próximo disparo.
 */
export function isGoneSubscription(error: unknown): boolean {
  return error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410);
}
