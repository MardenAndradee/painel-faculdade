import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
  type RuntimeCaching,
} from 'serwist';

/**
 * Estratégias de cache em runtime do Service Worker (Etapa 28.4).
 *
 * Separado de `app/sw.ts` de propósito: aquele arquivo roda no escopo de um
 * Worker (globais incompatíveis com `dom`, checado à parte por
 * `tsconfig.worker.json`) e não pode ser importado por um teste comum. Este
 * módulo é TypeScript normal - só monta o array de configuração, sem tocar
 * em `self` - e por isso é testável (`sw-runtime-caching.test.ts`), o que dá
 * à guarda de `/api/` (risco R1 do plano) uma rede de segurança que roda em
 * CI, sem precisar de um navegador real.
 *
 * A ORDEM importa: rotas são avaliadas em sequência e a primeira que casar
 * vence. A guarda de `/api/` fica PRIMEIRO, mesmo que nenhuma regra abaixo
 * dela também mexa com `/api/` hoje - é a garantia de que uma regra futura
 * adicionada por engano depois dela nunca alcança uma resposta autenticada.
 *
 * Deliberadamente NÃO usamos `defaultCache` de `@serwist/next/worker` (ou
 * seu equivalente): a config padrão cacheia respostas de `/api/*` em Cache
 * Storage (`NetworkFirst`, cache "apis", 24h) - exatamente o que este
 * projeto não pode fazer, já que a API é same-origin via rewrite da Vercel.
 * Preferimos uma lista curta e auditável, escrita à mão, a filtrar entradas
 * de uma lista de terceiros que pode mudar de formato entre versões.
 */
export const runtimeCaching: RuntimeCaching[] = [
  // GUARDA: nenhuma resposta de /api/ (mesma origem) entra em Cache Storage,
  // nunca - nem GET, nem nenhum outro método. NetworkOnly não grava nada.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },

  // JS/CSS/workers com hash no nome do arquivo - o conteúdo nunca muda sob a
  // mesma URL, então cache-first é seguro e rápido.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
    handler: new CacheFirst({
      cacheName: 'next-static',
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },

  // Fontes do Google, carregadas pelo next/font a partir do proprio dominio
  // em producao - mesmo tratamento de asset com hash.
  {
    matcher: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
    handler: new CacheFirst({
      cacheName: 'google-fonts',
      plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 })],
    }),
  },

  // Foto de perfil do Google (avatar do usuario) - publica, mas pode mudar;
  // serve o que ja tem na hora e atualiza em segundo plano.
  {
    matcher: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'google-avatars',
      plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },

  // Navegacoes (documentos HTML de rota): tenta a rede primeiro - dado
  // desatualizado numa tela de app academico e pior que uma espera curta.
  // Cai para a pagina /offline (pre-cacheada) quando a rede falha, via
  // `fallbacks` na configuracao do Serwist em app/sw.ts.
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
    handler: new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 10,
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 })],
    }),
  },
];
