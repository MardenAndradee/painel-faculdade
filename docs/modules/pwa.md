# PWA (Etapa 28)

Instala como app, funciona com prazos vistos anteriormente sem rede, avisa quando há versão nova, e manda push do que vence logo. Notas, boletim, estatísticas e histórico **nunca** saem do banco - nem para o Service Worker, nem para o IndexedDB do navegador.

## Manifest e ícones (28.2/28.3)

`app/manifest.ts` gera `/manifest.webmanifest` (convenção do App Router). `start_url: '/dashboard'` - quem instalou já tem sessão, cair na raiz só para ser redirecionado piscaria a tela de login. `theme_color`/`background_color` fixos em `#0b0d12` (escuro): o manifest é lido pelo sistema operacional na instalação, não reage ao tema do app, e um valor claro daria flash branco ao abrir no escuro.

Ícones em `public/` (não em `app/` - nomes arbitrários não entram na convenção de ícones do Next): `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. O maskable usa zona segura de 80%, gerado com `sharp` a partir das cores de marca fixas de `globals.css` (`--brand-mark-*`), já que CSS custom properties não existem fora do DOM em tempo de build.

## Service Worker (28.4)

**Desvio da Decisão #6 do plano original.** O plano previa `@serwist/next` (plugin webpack, gera `sw.js` estático em build). O Next 16 usa Turbopack por padrão em `next build`, incompatível com plugins webpack - a build falhava com `ERROR: This build is using Turbopack, with a webpack config and no turbopack config`. Trocado por `@serwist/turbopack`, que serve o SW dinamicamente via um Route Handler (`app/[path]/route.ts`, gerado estaticamente com `generateStaticParams`/`dynamicParams: false`) em vez de um arquivo estático.

**`runtimeCaching` escrito à mão, não `defaultCache`.** A configuração "padrão" de `@serwist/next/worker` cacheia `/api/*` com `NetworkFirst({ cacheName: 'apis' })` - exatamente o que este projeto não pode fazer, já que a API é same-origin via rewrite da Vercel e o SW estaria guardando resposta autenticada em Cache Storage. `lib/sw-runtime-caching.ts` define uma lista curta e auditável:

1. **Guarda `/api/`** (`NetworkOnly`) - primeira da lista, sempre. Testada por `sw-runtime-caching.test.ts`: confirma que é a primeira entrada, que `NetworkOnly` nunca grava em cache, e que nenhum `cacheName` do arquivo é `'apis'`. Mutação deliberada (remover a guarda, trocar por `NetworkFirst`) confirmou que o teste pega a regressão.
2. `next-static` (`CacheFirst`) - `_next/static/*`, tem hash no nome, nunca muda sob a mesma URL.
3. `google-fonts` (`CacheFirst`).
4. `google-avatars` (`StaleWhileRevalidate`) - foto de perfil do Google, pública mas pode mudar.
5. `pages` (`NetworkFirst`, timeout de 10s) - navegações. Cai para `/offline` (pré-cacheada) quando a rede falha, via `fallbacks.entries` na config do `Serwist` em `app/sw.ts`.

O import de `runtimeCaching` em `app/sw.ts` é **relativo**, não o alias `@/*`: o bundler é o esbuild (via `@serwist/turbopack`), que não lê os `paths` do `tsconfig.json` do Next.

**Split de `tsconfig`.** `app/sw.ts` roda em escopo de Worker (`self`, `ServiceWorkerGlobalScope`) - incompatível com `lib: ["dom"]` do resto do app numa única config. Excluído do `tsconfig.json` principal, checado à parte por `tsconfig.worker.json` (`lib: ["ES2023", "WebWorker"]`). `npm run typecheck` roda os dois em sequência.

`skipWaiting: true`, `clientsClaim: true`, `navigationPreload: true`. Desabilitado fora de produção (`disable: process.env.NODE_ENV !== 'production'` no `SerwistProvider`, em `app/layout.tsx`) - um SW ativo em desenvolvimento intercepta fetch e serve bundle velho do cache em vez do que acabou de ser salvo, atrapalhando o hot reload.

## Offline (28.5)

`app/offline/page.tsx` - página estática, sem *fetch*, para quando a rede falha numa navegação nunca visitada. `hooks/use-online-status.ts` mais `components/layout/offline-banner.tsx` - faixa fina no topo, só quando `navigator.onLine` é falso, deliberadamente **não** empilhada com o header sticky (ficaria um sticky sobre o outro).

## Persistência em IndexedDB (28.6)

**Lista de permissão explícita, nunca lista de bloqueio** (risco R9 do plano original) - `lib/query-persistence.ts`:

```
PERSISTABLE_QUERY_KEY_PREFIXES = ['subjects', 'exams', 'assignments', 'calendar']
```

Uma chave de query nova só é persistida se alguém adicionar o prefixo aqui **de propósito**; o padrão é nunca gravar em disco. `isPersistableQueryKey` é testada por mutação (`query-persistence.test.ts`): adicionar `'grades'` à lista faz o teste falhar.

Persister por usuário via `@tanstack/react-query-persist-client` + `idb-keyval`, chave `painel-query-cache:${userId}` - o namespaceamento por usuário resolve isolamento e "descarta se o usuário logado não bate com o dono" com o mesmo mecanismo simples, sem bookkeeping de posse separado. `QueryPersistenceProvider` (dentro do `AuthProvider`, para ter `user.id`) chama `persistQueryClientRestore` ao carregar e `persistQueryClientSubscribe` (filtrado por `shouldDehydrateQuery: isPersistableQueryKey`) para manter persistindo. Ao detectar troca de usuário (o `user.id` anterior, guardado em `ref`, difere do atual - inclui logout, onde vira `null`), apaga o registro do usuário anterior do IndexedDB.

## Segurança (transversal a todas as etapas acima)

1. **`queryClient.clear()` no logout** (Etapa 28.1, já existia antes deste módulo) - sem isso, trocar de usuário no mesmo aparelho podia mostrar dado do usuário anterior por até `gcTime`.
2. **`/api/*` nunca em Cache Storage** - guarda de `sw-runtime-caching.ts`, acima.
3. **SW desregistrado e `caches` limpos no logout** - `lib/pwa-cleanup.ts` (`clearServiceWorkerState`), chamado em `AuthProvider`'s `logout()` e no handler de sessão expirada. Não por haver dado pessoal em `caches` hoje (não há) - é para que uma versão futura que passe a cachear algo por engano não deixe resíduo atravessando a troca de conta.
4. **`viewportFit: 'cover'`** (`app/layout.tsx`, `viewport` export) - `env(safe-area-inset-*)` resolve como zero no iOS sem isso.
5. HTTPS já é dado pela Vercel (pré-requisito de SW).
6. **Permissão de notificação só sob ação explícita** - `usePushSubscription().subscribe()` nunca é chamado ao montar nenhum componente, só a partir do clique no Switch de Configurações → Preferências.

## Instalação (28.7)

`lib/install-prompt.ts` decide o que mostrar - função pura, testada (`install-prompt.test.ts`, com mutação confirmando a prioridade botão-real-sobre-instruções-manuais):

- **Já instalado ou dispensado** → nada.
- **`beforeinstallprompt` disparou** (Chrome/Edge) → botão real, `useInstallPrompt` guarda o evento (com `preventDefault`) para chamar `.prompt()` sob o clique.
- **iOS sem esse evento** (Safari nunca dispara, e nunca vai) → instruções manuais ("toque em Compartilhar, depois Adicionar à Tela de Início"). Detecção de iOS por user agent, com o caso especial do iPad em iOS 13+ (se anuncia como Mac - decidido por `maxTouchPoints > 1`).
- **Nenhum dos dois** (ex.: Firefox desktop) → nada. Nunca um botão que não faz nada ao clicar.

Card em `components/dashboard/install-app-card.tsx`, no Dashboard - dispensa gravada em `localStorage`, some em modo standalone.

## Navegação mobile (28.8)

`components/layout/bottom-nav.tsx` - barra fixa no rodapé, só abaixo de `lg`, `pb-[env(safe-area-inset-bottom)]`. Cinco itens fixos (Início, Turmas, Ativid., Provas, Notas - rótulos abreviados de propósito, 6 itens em 360px dão ~60px cada) mais "Mais", que abre a mesma gaveta (`Sheet`) do hambúrguer do header. Filtrados pelos módulos ativos (`useIsModuleEnabled`), mesmo critério da Sidebar.

Alvo de toque da gaveta mobile subiu de `py-2` (~36px) para `py-3` (~44px) - só ali, a sidebar fixa do desktop continua com `py-2` (`sidebar-nav.tsx`, `touchPadding` decidido pela presença de `onNavigate`, que só a gaveta recebe).

Visão Mês do calendário (`calendar-views.tsx`): abaixo de `sm`, cada dia mostra só um marcador de cor por item (até 4, depois "+N"), sem título - a célula não cabe texto legível num aparelho estreito. Tocar em qualquer marcador abre o dia inteiro.

## Atualização do app (28.9)

`hooks/use-service-worker-update.ts`, sobre `useSerwist()` de `@serwist/turbopack/react`. Evento `waiting` do SW: `isGenuineUpdate` (`lib/service-worker-update.ts`, testada por mutação) só sinaliza quando `isUpdate === true` - o mesmo evento dispara na primeira instalação, e avisar "nova versão" nesse caso confundiria quem está vendo o app pela primeira vez. Clique em "Atualizar" no toast (`components/pwa/sw-update-toast.tsx`) manda `SKIP_WAITING`; o SW novo assume (`clients.claim()`, já configurado), o que dispara `controllerchange` → evento `controlling` aqui → só então a página recarrega, depois que o SW novo já está no controle.

## Push Notifications (28.11)

Sem worker ou fila dedicados - o disparo roda sob demanda quando o **Vercel Cron** chama `GET /push/dispatch` (`vercel.json`, `crons`, diário às 11:00 UTC), reaproveitando a mesma `notificationService.generatePending` que a central de notificações (Etapa 19) já usa sob demanda ao abrir o sino. Uma única fonte de verdade para "o que deve existir agora" - o push só decide, dentre isso, o que empurrar.

### Banco

```
PushSubscription
  id, endpoint (único), p256dh, auth, userAgent?, createdAt, userId
  -- vários por usuário: cada navegador/aparelho gera o seu

Notification.pushedAt  DateTime?
  -- coluna nova (não estava no plano original). Marca o que já virou push,
  -- para o disparo diário não reenviar a mesma notificação todo dia
  -- enquanto o estado não muda. Só URGENT/ATTENTION viram push - nunca
  -- INFO ("vence em 3 dias" não interrompe, "vence amanhã" interrompe).
```

### Autenticação das rotas

`POST /push/subscribe` e `POST /push/unsubscribe` exigem sessão (Bearer), como qualquer outra rota. `GET /push/dispatch` usa um segredo compartilhado (`CRON_SECRET`) no header `Authorization: Bearer <CRON_SECRET>` - o mesmo formato que a Vercel envia automaticamente nas chamadas de cron quando essa variável está configurada no projeto.

**Armadilha descoberta e corrigida durante a implementação:** todo router deste backend usa `router.use(authenticate)` **sem caminho** - o que faz esse middleware rodar para *qualquer* requisição que chegue àquele router, mesmo uma que nenhuma rota dele de fato atenda. Registrar `pushRoutes` na posição natural (por ordem alfabética, no fim de `routes/index.ts`) fazia `GET /push/dispatch` ser barrado por um `authenticate` de um router **anterior e completamente não relacionado**, antes mesmo de chegar ao `pushRoutes` e seu `cronAuth`. Confirmado com curl contra o servidor local rodando de verdade (a chamada com o `CRON_SECRET` correto devolvia 401 `INVALID_TOKEN`, vindo de um router errado). Corrigido registrando `pushRoutes` **antes** de qualquer router com `authenticate` sem caminho (logo após `healthRoutes`) - mesma regra que já vale, silenciosamente, para `authRoutes`.

### Disparo (`push.service.ts`)

Para cada usuário com ao menos uma inscrição: roda `generatePending`, busca notificações `pushedAt: null`, `readAt: null`, prioridade `URGENT`/`ATTENTION`, tipo em `SCANNED_TYPES` (as mesmas três que a varredura de prazos administra). Envia via `web-push` a cada inscrição do usuário. Uma inscrição que responde `404`/`410` (risco R8) é apagada na hora - dispositivo desinstalado ou permissão revogada, senão a tabela vira lixo acumulado. `isGoneSubscription` (`utils/push-errors.ts`) decide isso, testada por mutação.

### Chaves VAPID

Par gerado uma vez com `npx web-push generate-vapid-keys` - `VAPID_PUBLIC_KEY` pública (também em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no frontend), `VAPID_PRIVATE_KEY` só no ambiente da API. Trocar o par invalida todas as inscrições existentes. Ambas opcionais no boot (como `STORAGE_DRIVER=r2`) - sem elas o app sobe normalmente, e só o disparo/inscrição falha explicitamente, com mensagem clara.

### Frontend

`hooks/use-push-subscription.ts` - `status` reflete `Notification.permission` (ou `'unsupported'`, incluindo Safari fora do iOS 16.4+/instalado). `isSubscribed` é lido do `PushManager` de verdade a cada carregamento, não guardado localmente - uma inscrição revogada por fora do app (ex.: limpar dados do site) aparece correta sem depender de sincronizar estado. `urlBase64ToUint8Array` (`lib/push-subscription.ts`, testada com uma chave VAPID real) converte a chave pública de base64url para o `Uint8Array` que `PushManager.subscribe` exige.

No Service Worker (`app/sw.ts`): `push` mostra a notificação do sistema com o payload (`title`/`body`/`entityType`); `notificationclick` foca uma aba já aberta na URL certa (`resolveNotificationUrl`, `lib/push-notification-url.ts`, testada por mutação - `ASSIGNMENT` → `/atividades`, `EXAM` → `/provas`, resto → `/dashboard`) em vez de empilhar abas novas.

## Preferências (28.12)

Nova aba **Configurações → Preferências**, junto de Módulos/Integrações/Conta - o plano original previa uma página nova, mas Configurações já existia (Etapa 29) por quando esta etapa chegou.

**Tema sincronizado.** `PATCH /auth/me` (schema `updateProfileSchema`, campo `theme`) já existia no backend desde a Etapa 26, documentado mas **sem nenhum chamador na interface** - por isso o tema nunca sobrevivia a trocar de aparelho, apesar do dado já existir no banco. `useUpdateProfile` liga isso: tanto o seletor da aba Preferências quanto o dropdown rápido do header (`ThemeToggle`) agora chamam a mesma mutação, para as duas rotas de troca de tema não divergirem. `ThemeSyncProvider` aplica o tema salvo no servidor **uma única vez** por usuário carregado (guardado por `ref`, nunca de novo depois disso) - o suficiente para resolver "entrei num aparelho novo e o tema veio errado" sem correr o risco de uma reconciliação contínua desfazer uma troca feita na hora, na própria tela.

**Notificações push.** Mesmo `usePushSubscription` de 28.11, com um `Switch` - liga pede permissão e inscreve, desliga cancela a inscrição e avisa o backend. Estado `unsupported`/`denied` mostra explicação em vez do controle.

## Compatibilidade e limites da verificação

Testado neste ambiente (sem acesso a navegador/dispositivo real, só terminal): build de produção completo (`next build`, com Turbopack, gerando `/sw.js` via esbuild), servidor standalone rodando de verdade com inspeção HTTP das rotas (`/manifest.webmanifest`, `/offline`, `/push/dispatch` com e sem `CRON_SECRET`), suíte de testes completa (toda regra pura extraída para fora de `app/sw.ts`/componentes React, testada e **verificada por mutação** - quebrar a regra de propósito e confirmar que o teste correspondente falha), `tsc` nas duas configs (`tsconfig.json` + `tsconfig.worker.json`) e lint.

**Não verificado neste ambiente** (exige dispositivo físico): instalação e push de verdade no Safari iOS 16.4+ (só o `beforeinstallprompt`/Chrome tem caminho de teste automatizável aqui), aparência real da barra inferior e do calendário em telas de 360px, e o fluxo completo de "atualizar sem perder sessão" contra um deploy real na Vercel. `docs/planning/pwa.md` já registrava essa lacuna como pergunta em aberto ("acesso a um iPhone físico") - continua sendo o próximo passo antes de considerar 28.3/28.7/28.11 cobertas no iOS especificamente.
