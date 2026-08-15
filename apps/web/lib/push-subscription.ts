/**
 * Conversão da chave pública VAPID (Etapa 28.11).
 *
 * `PushManager.subscribe({ applicationServerKey })` exige um `Uint8Array`,
 * mas a chave é distribuída como texto base64url (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
 * - o mesmo formato que `web-push generate-vapid-keys` imprime.
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}
