/**
 * Limpeza de resíduo do Service Worker no logout - item 3 da seção de
 * Segurança do plano de PWA.
 *
 * Não é por haver dado pessoal em `caches` hoje (não há - `/api/*` nunca
 * entra lá, ver `sw-runtime-caching.ts`). É para que uma versão futura que
 * passe a cachear algo por engano não deixe resíduo atravessando a troca de
 * usuário no mesmo aparelho.
 */
export async function clearServiceWorkerState(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();

    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}
