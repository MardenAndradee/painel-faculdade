/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';
// Import relativo, e nao o alias `@/*`: o bundler deste arquivo e o esbuild
// (via @serwist/turbopack), que nao le os `paths` do tsconfig do Next.
import { runtimeCaching } from '../lib/sw-runtime-caching';
import { resolveNotificationUrl } from '../lib/push-notification-url';

/**
 * Service Worker (Etapa 28.4).
 *
 * Roda no escopo de um Worker, com globais (`self`, `ServiceWorkerGlobalScope`)
 * incompatíveis com o `dom` usado pelo resto do app - checado à parte por
 * `tsconfig.worker.json`, e por isso excluído do `tsconfig.json` principal
 * (ver o comentário lá). As estratégias de cache em si moram em
 * `lib/sw-runtime-caching.ts` - TypeScript comum, testável, importado aqui.
 *
 * `self.__SW_MANIFEST` é substituído em build (pelo Route Handler em
 * `app/[path]/route.ts`, via `@serwist/turbopack`) pela lista real de
 * assets com hash - é o mecanismo de pré-cache.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Push Notifications (Etapa 28.11).
 *
 * `push`: exibe a notificacao do sistema com o payload que `push.service.ts`
 * montou (`title`/`body`/`entityType`/`entityId`). `notificationclick`: foca
 * uma aba ja aberta na URL certa em vez de abrir outra - varios cliques na
 * mesma notificacao (ou em notificacoes diferentes do mesmo tipo) nao devem
 * empilhar abas.
 */
interface PushPayload {
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json() as PushPayload;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { entityType: payload.entityType ?? null },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data as { entityType?: string | null } | undefined;
  const url = resolveNotificationUrl(data?.entityType);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      const existing = clientsList.find((client) => new URL(client.url).pathname === url);

      if (existing && 'focus' in existing) return existing.focus();

      return self.clients.openWindow(url);
    }),
  );
});
