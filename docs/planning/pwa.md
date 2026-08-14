# PWA — Progressive Web App (planejado)

> **Só análise e plano — nada foi implementado.** Nenhum arquivo alterado,
> nenhuma dependência instalada, nenhum manifest ou Service Worker criado.
> Este documento levanta o estado atual, avalia viabilidade, propõe a
> arquitetura e divide o trabalho em etapas. As decisões de escopo já foram
> respondidas (tabela "Decisões"); resta uma pergunta ao final, que não
> bloqueia o começo. A implementação começa na Etapa 28.1.

## Objetivo

Permitir instalar o Painel Faculdade na tela inicial do celular e usá-lo com
cara de aplicativo: ícone próprio, abertura em modo standalone (sem barra de
endereço), carregamento rápido e uma experiência offline **limitada e
segura**. Push Notifications entram depois, como etapa própria.

## Veredito de viabilidade

**Viável, e a maior parte é trabalho pequeno.** Manifest, ícones e instalação
são um punhado de arquivos. O que exige cuidado real é o **cache**, e por um
motivo específico deste projeto, não do PWA em geral — descrito abaixo.

Também vale dizer o que **não** é problema: não existe uma única tabela HTML
no frontend (tudo é grid de cards que empilha em uma coluna no celular), então
o medo clássico de "tabela larga não cabe no telefone" simplesmente não se
aplica aqui.

## O que a análise encontrou

| Onde | O que é hoje | Por que importa pro PWA |
| --- | --- | --- |
| Infra de PWA | **Zero.** Sem manifest, sem Service Worker, sem `next-pwa`/`serwist`/`workbox` instalado, sem `apple-mobile-web-app-*` | Terreno limpo — nenhuma decisão anterior pra desfazer |
| `apps/web/public/` | **A pasta não existe** | Precisa ser criada, ou os arquivos entram como convenção de arquivo do App Router (padrão que `app/icon.svg` já usa) |
| Ícones existentes | `app/icon.svg` (100×100, cores **hardcoded** `#2563EB`/branco, versão simplificada da marca) e `app/apple-icon.png` (180×180) | Faltam 192×192, 512×512 e o maskable. O `icon.svg` já resolveu, na mão, o problema descrito na linha seguinte |
| `components/brand/logo.tsx` | SVG cujas cores vêm **100% de CSS custom properties** (`fill-brand-mark-*` → `--brand-mark-*`), diferentes em claro e escuro | **Não dá pra rasterizar esse componente direto**: fora do DOM do app, as variáveis não existem e o ícone sai sem cor. Os PNGs do manifest precisam de uma paleta fixa embutida |
| Produção (Vercel) | `apps/web/vercel.json` reescreve `/api/:path*` para o domínio da API — do ponto de vista do navegador, **a API é same-origin** | Crítico: um Service Worker **intercepta as chamadas autenticadas por padrão**. Não é um caso que dá pra ignorar "porque a API está em outro domínio" — ela não está |
| Access token | Só em memória (variável de módulo em `services/http-client.ts`), viaja como header `Authorization: Bearer` | Um `fetch` interceptado pelo SW **enxerga esse header**. É por aí que um cache mal feito vaza dado, não pelo cookie |
| Refresh token | Cookie `painel_refresh_token`, `httpOnly`, `path=/api/v1/auth`, 7 dias, `sameSite=none`+`secure` em produção | O SW **não consegue ler** (httpOnly) e o cookie nem acompanha chamadas fora de `/api/v1/auth`. Esse lado está seguro por construção |
| **Logout** | `authService.logout()` limpa o token em memória, o `user` e o timer de renovação. **Nunca chama `queryClient.clear()`** — nenhuma chamada a `clear`/`removeQueries`/`resetQueries` existe no projeto | **Já é um vazamento hoje, sem PWA nenhum**: o cache do TanStack Query (`gcTime` de 5 min) sobrevive ao logout. Trocar de usuário sem recarregar a página pode mostrar dado do anterior. Um cache em disco transformaria "5 minutos na memória" em "para sempre" |
| `QueryClient` | `staleTime` 1 min, `gcTime` 5 min, `refetchOnWindowFocus: false` | `refetchOnWindowFocus: false` é ruim pra celular: voltar pro app depois de horas mostra dado velho sem revalidar |
| Notificações | Modelo `Notification` no banco (in-app), com um campo `scheduledFor` que já existe | Base pronta pro conteúdo das push; falta **toda** a infra de entrega |
| Push | **Nada.** Nenhum campo de subscription/endpoint/device no `User`, nenhuma tabela, nenhum VAPID | Etapa própria, do zero: tabela nova, chaves VAPID, endpoints, permissão do usuário |
| Preferências | Não existe tela de Configurações. Tema mora num dropdown (`theme-toggle.tsx`) via `next-themes` e **nem sequer é salvo em `User.theme`** — o `PATCH /auth/me` existe no backend e não tem nenhum chamador na interface | A tela de preferências de notificação (§15 do pedido) precisaria criar essa página, que hoje não existe |
| `viewport` no layout | `width=device-width, initialScale=1`, `themeColor` claro/escuro. **Sem `viewportFit: 'cover'`** | Sem isso, `env(safe-area-inset-*)` **resolve como zero** no iOS. Qualquer padding de área segura seria inerte |
| Área segura | Nenhum `env(safe-area-inset-*)` em lugar nenhum do CSS | Em standalone num iPhone com notch, o header grudaria embaixo da ilha dinâmica |
| Sidebar mobile | `Sheet` (gaveta) abaixo de `lg`, itens com `py-2` (~36px de altura) | Abaixo dos ~44px recomendados para toque |
| Diálogos | Card centrado `w-[calc(100%-2rem)] max-w-lg` em **todos** os tamanhos; botões do rodapé empilham no celular | Nunca vira tela cheia nem *bottom sheet*. Funciona, mas o "X" no topo direito é longe do polegar num celular grande |
| Calendário | Semana e Dia **já são responsivos** (empilham no celular). Mês continua `grid-cols-7` fixo em qualquer largura | Único ponto do calendário que aperta de verdade num telefone (~45px por coluna) |
| Listagens | **Nenhuma tabela HTML no projeto inteiro.** Tudo é grid de cards `sm:grid-cols-2 lg:grid-cols-*`, uma coluna por padrão | Mobile-safe por construção — não há o que consertar aqui |
| Flashcards | Fora da navegação por decisão anterior ("visual atual não ficou bom, será refeita") | **Continuam fora** (Decisão #9) — a barra inferior não os inclui, e o Plano de Estudos (item 27) vai acessá-los por dentro |

## O problema central: cache e dados de aluno

Vale separar bem, porque é o que decide o formato do plano inteiro.

Primeiro, o que **não** está em discussão: cache para reduzir chamadas de API
já existe e funciona. O TanStack Query mantém as respostas em memória
(`staleTime` 1 min, `gcTime` 5 min), então circular entre telas não refaz
requisição nenhuma. Nada aqui mexe nisso.

O que se discute é **persistir esse cache em disco**. Isso quase não muda a
carga do servidor — muda outra coisa: o cache passa a sobreviver ao
fechamento do app. E isso importa mais no PWA do que hoje, porque **em modo
standalone o usuário fecha e reabre o app o tempo todo**, e cada abertura
fria hoje perde a memória inteira e refaz tudo. Numa aba de navegador, que
fica aberta por dias, o problema quase não aparece.

O custo está em **onde** esse disco mora. Tanto Cache Storage quanto
IndexedDB têm três propriedades incômodas juntas:

1. **São por origem, não por usuário.** Não existe "cache do Marden" — existe
   "cache de painelfaculdade.com". Dois logins no mesmo aparelho compartilham
   o mesmo espaço.
2. **Sobrevivem ao logout.** Nada é apagado automaticamente ao encerrar sessão.
3. **São legíveis por qualquer JavaScript da origem.**

Sobre o item 3, sendo justo: quem consegue XSS aqui já consegue chamar a API
com o token em memória e baixar tudo. O disco piora **marginalmente**, não
catastroficamente. O argumento forte não é esse — é o item 2, combinado com
um achado concreto: **o logout deste projeto não limpa nem o cache de
memória hoje.** Não existe `queryClient.clear()` em lugar nenhum. A lógica de
ciclo de vida de cache já está com um vazamento em produção agora, e é por
isso que a limpeza no logout (Etapa 28.1) vem **antes** de qualquer
persistência.

O segundo ponto é **o que** se guarda. "Dado acadêmico" não é uma coisa só:

| Dado | Sensibilidade | Valor offline |
| --- | --- | --- |
| **Notas / boletim** | **Alta** — ninguém quer que um amigo pegue o celular emprestado e veja que reprovou | Baixo: nota não muda de hora em hora |
| Provas e atividades (prazos) | Baixa — é uma lista de tarefas | **Alto** — é o caso de uso real: ver a prova de amanhã no metrô |
| Disciplinas | Baixa — nome de matéria | Alto (dá contexto ao resto) |
| Turmas, flashcards, materiais | Média (turma tem nome de outros alunos) | Médio |

Daí a política adotada (Decisão #1): **persistir prazos, nunca notas.** Isso
entrega o caso de uso que motiva o offline, com muito menos em jogo se a
limpeza falhar.

### Estratégia de cache por tipo

| O que | Estratégia | Vai pro disco? |
| --- | --- | --- |
| JS, CSS, fontes, ícones, `_next/static/*` | *Cache first* — o nome do arquivo já tem hash, o conteúdo nunca muda | **Sim**, sem ressalva |
| Página offline (`/offline`) | Pré-cacheada no install do SW | **Sim** |
| Documentos HTML das rotas (`/dashboard`, `/provas`...) | *Network first*, caindo pra página offline se falhar | Só a casca do app, **sem dado** |
| Avatar do Google (`lh3.googleusercontent.com`) | *Stale while revalidate*, outra origem | Sim (é público) |
| **Qualquer** `/api/v1/*` no **Service Worker** | **Nunca em Cache Storage** | **Não** — ver a regra de guarda abaixo |
| `GET` de disciplinas, provas, atividades, calendário | Persistido pelo **TanStack Query em IndexedDB**, por usuário | **Sim** (Etapa 28.6) |
| `GET` de **notas, boletim, estatísticas, histórico** | Só memória, como hoje | **Nunca** |
| Turmas, flashcards, materiais | Só memória nesta rodada — reavaliar depois | Não |
| `POST`/`PATCH`/`DELETE` de qualquer rota | Nunca interceptado; falha offline com erro claro | **Não** |
| `/api/v1/auth/*` | **Explicitamente excluído** do SW, inclusive de log | **Não** |

Repare na separação entre as duas linhas de `/api/`: o **Service Worker**
nunca toca em resposta de API — a persistência de prazos acontece uma camada
acima, no TanStack Query, onde dá para namespaçar por `userId` e limpar no
logout com precisão. Um cache do SW não teria como saber de quem é o dado.

O SW precisa de uma regra de guarda explícita — algo como "se a URL casa com
`/api/`, devolve `fetch(request)` sem tocar em cache" —, e não confiar em não
ter escrito uma regra de cache pra ela. É a diferença entre "não cacheia" e
"não pode cachear nem por acidente numa mudança futura".

## Escolha de biblioteca: Serwist

Escrever `sw.js` na mão significa reimplementar versionamento de cache,
`skipWaiting`, limpeza de cache obsoleto e pré-cache do build do Next —
justamente o tipo de coisa que dá errado silenciosamente.

| Opção | Avaliação |
| --- | --- |
| **`@serwist/next`** | **Recomendada.** Sucessor mantido do `next-pwa`, feito para App Router, gera o pré-cache a partir do build do Next, permite escrever o SW em TypeScript com as rotas de cache declaradas explicitamente |
| `next-pwa` | Sem manutenção há tempos, feito para o Pages Router. Não |
| `workbox-*` direto | Funciona, mas exige montar à mão a integração com o build do Next — que é exatamente o que o Serwist faz por cima do próprio Workbox |
| SW manual | Só se a ideia fosse cachear duas coisas e nada mais. O pré-cache do bundle do Next já justifica a ferramenta |

**Uma dependência nova** (`@serwist/next` + `serwist`), ambas de
desenvolvimento/build. Nada em runtime além do SW gerado.

## Manifest e ícones

O manifest entra como `apps/web/app/manifest.ts` — rota do App Router que
devolve o objeto tipado (`MetadataRoute.Manifest`), não um JSON solto. Mesma
lógica do `icon.svg`/`apple-icon.png` que o projeto já usa: convenção de
arquivo, sem configuração manual de `<link>`.

```
name             Painel Faculdade
short_name       Painel            (limite prático ~12 caracteres embaixo do ícone)
description      (a mesma do metadata atual)
start_url        /dashboard        (ver Decisão #2)
display          standalone
theme_color      #0b0d12           (ver Decisão #3)
background_color #0b0d12
orientation      portrait
lang             pt-BR
```

Ícones necessários, todos PNG, todos com **paleta fixa embutida** (não dá pra
usar o `logo.tsx`, que depende de variável CSS):

| Arquivo | Tamanho | `purpose` | Observação |
| --- | --- | --- | --- |
| `icon-192.png` | 192×192 | `any` | Mínimo exigido para instalação |
| `icon-512.png` | 512×512 | `any` | Splash screen do Android |
| `icon-maskable-512.png` | 512×512 | `maskable` | **Arte dentro de um círculo de 80% do quadro** — o Android recorta em círculo, gota, quadrado arredondado... conforme o fabricante. A marca precisa caber na zona segura, com a cor de fundo sangrando até a borda |
| `apple-icon.png` | 180×180 | — | **Já existe** |
| `icon.svg` | — | — | **Já existe** (favicon) |

O `maskable` é o único que exige arte diferente, não só reescala: o
`icon.svg` atual desenha a marca ocupando quase todo o quadro, e num recorte
circular as pontas do "P" seriam cortadas. Precisa de uma versão com margem —
mesmo tipo de adaptação que o `icon.svg` já fez ao remover o painel e o ponto
para 16px.

## Instalação por plataforma

| Plataforma | Como instala | O que precisamos |
| --- | --- | --- |
| **Chrome/Edge Android** | Evento `beforeinstallprompt` — dá pra oferecer um botão próprio e chamar `prompt()` | Manifest + SW + HTTPS. Funciona bem |
| **Chrome/Edge Desktop** | Mesmo evento, ícone na barra de endereço | Idem |
| **Safari iOS/iPadOS** | **Não existe `beforeinstallprompt`.** Só manual: Compartilhar → "Adicionar à Tela de Início" | Instruções na tela, já que não há prompt programático. `apple-mobile-web-app-*` via `appleWebApp` no `metadata` |
| **Firefox Android** | Instala, mas sem o evento padrão | Cai nas instruções manuais |
| **Firefox Desktop** | **Não instala PWA** | Nada a fazer; o app continua funcionando como site |

O botão "Instalar aplicativo" só aparece quando faz sentido — três condições:

1. o evento `beforeinstallprompt` foi capturado (Android/desktop), **ou** é
   Safari iOS (aí mostra instruções em vez do botão);
2. o app **não** está rodando em standalone
   (`matchMedia('(display-mode: standalone)')` e, no iOS,
   `navigator.standalone`);
3. o usuário não dispensou o convite antes (guardar a dispensa em
   `localStorage` — é preferência de interface, não dado pessoal).

Onde colocar: um card discreto no Dashboard, não um banner fixo. Um convite
de instalação que acompanha o usuário por todas as telas é o tipo de coisa
que faz desinstalar.

## Modo offline

Escopo: **o app abre offline, mostra prazos e disciplinas, e explica o que
não dá pra fazer.** Notas e estatísticas não ficam disponíveis offline por
decisão (§ acima).

| Situação | Comportamento |
| --- | --- |
| Offline, rota já visitada, dado persistido (provas, atividades, disciplinas, calendário) | Carrega do IndexedDB, com aviso de "dados de {quando}" |
| Offline, tela de **Notas/Estatísticas/Histórico** | Estado vazio explicando que exige conexão — nunca foi pro disco |
| Offline, rota nunca visitada | Página `/offline`: "Você está offline", com link para o Dashboard |
| Volta a ter rede | O TanStack Query revalida sozinho ao reconectar (`onlineManager`); acrescentar `refetchOnReconnect` explícito |
| Tenta criar/editar qualquer coisa offline | Erro claro ("Sem conexão — tente de novo quando voltar"). **Sem fila de sincronização** |

**Nada de Background Sync / fila de escrita offline.** Foi considerado e
descartado: uma nota lançada offline que só sobe meia hora depois cria
conflito com o que o Google Classroom sincronizou no meio do caminho, e o
sistema não tem resolução de conflito. Melhor recusar na hora do que aceitar e
divergir depois.

Um indicador de estado offline (uma faixa fina no topo, aparecendo só quando
`navigator.onLine` é falso) resolve a maior parte da confusão sem custo.

## Segurança

O que fazer, em ordem de importância:

1. **Limpar o `QueryClient` no logout.** `queryClient.clear()` em
   `authService.logout()` e no `onSessionExpired`. Isso é um bug **de hoje**,
   independente de PWA, e vira pré-requisito de qualquer cache em disco.
2. **Nunca cachear `/api/*` no SW**, com a regra de exclusão explícita
   descrita acima.
3. **Desregistrar o SW e limpar `caches` no logout** — não porque haveria
   dado pessoal lá (não haverá), mas para garantir que uma versão futura que
   passe a cachear algo não deixe resíduo. `caches.keys()` → `caches.delete()`.
4. **`viewportFit: 'cover'`** e área segura — não é segurança, mas entra junto
   porque é o mesmo arquivo.
5. **HTTPS já é dado** (Vercel), e é pré-requisito de SW.
6. **Permissão de notificação nunca no carregamento.** Só depois de uma ação
   explícita do usuário na tela de preferências. Navegador penaliza (e o
   usuário bloqueia para sempre) quem pede de cara.

Sobre XSS: com o recorte da Decisão #1, o que vai pro disco é lista de
prazo e nome de disciplina — o que um XSS já conseguiria puxar da API com o
token em memória. O que **não** vai é justamente o que doeria: nota,
boletim, estatística e histórico ficam só em memória, como hoje.

## Push Notifications (Etapa 28.11)

Entra nesta rodada, mas por último — depois de 28.1 a 28.10 estarem no ar.
Complexidade real, resumida:

- **Banco:** tabela nova (`PushSubscription`: `endpoint` único, `p256dh`,
  `auth`, `userAgent`, `createdAt`, `userId`). Um usuário tem **várias** —
  celular, notebook, tablet — então nunca é 1:1 com `User`.
- **Chaves VAPID:** par gerado uma vez, pública no frontend, privada em
  variável de ambiente. Trocar a chave invalida **todas** as subscriptions.
- **Backend:** biblioteca `web-push`, endpoints de registrar/remover
  subscription, e o disparo em si. Uma subscription morta responde `404`/`410`
  — precisa ser **apagada na hora**, senão a tabela vira lixo acumulado.
- **Quando disparar:** o modelo `Notification` já tem `scheduledFor`, mas não
  existe worker nem cron rodando hoje. Provavelmente o mesmo Vercel Cron já
  previsto para o dígest de e-mail (Etapa 25) — as duas coisas respondem à
  mesma pergunta ("o que vence amanhã?") e deviam compartilhar o cálculo.
- **iOS:** Web Push funciona a partir do iOS 16.4, **só se o app estiver
  instalado na tela inicial**. No Safari normal, não existe.

Fica por último por mérito próprio, não por cautela: é a única parte com
tabela nova, chave secreta, agendamento e dependência de infraestrutura.

## Preferências de notificação (Etapa 28.12)

Fecha a rodada, e depende de duas coisas que ainda não existem: as próprias
push (28.11) e **uma tela de Configurações, que o projeto não tem** — hoje o
tema mora num dropdown e nem é salvo no banco.

Uma decisão de modelagem fica em aberto até lá: as preferências de "avise
1/3/7 dias antes" podem virar colunas no `User` ou uma tabela
`NotificationPreference`. Colunas são mais simples e bastam se a lista de
opções for fixa; tabela só se compensa se as antecedências virarem
configuráveis por tipo de item. A escolha depende de como a tela ficar
desenhada, então fica registrada para a própria etapa resolver — não vale
decidir agora, no escuro.

Aproveitar a mesma tela para finalmente ligar o `PATCH /auth/me`, que existe
no backend e não tem um único chamador na interface (é por isso que o tema
escolhido não sobrevive a trocar de aparelho).

## Melhorias mobile

Só o que a análise apontou como problema concreto — sem redesenho.

| Item | Situação | Proposta |
| --- | --- | --- |
| Área segura | Nenhum tratamento; `viewportFit` ausente | `viewportFit: 'cover'` + padding com `env(safe-area-inset-*)` no header e no rodapé |
| Alvos de toque na sidebar | `py-2` (~36px) | Subir para ~44px **só** no `Sheet` mobile |
| Calendário — visão Mês | `grid-cols-7` fixo, ~45px por coluna no celular | Ver Decisão #5 |
| Diálogos | Card centrado em qualquer largura | *Bottom sheet* no celular seria melhor pra uma mão, mas mexe num primitivo usado em ~20 telas. **Fora do escopo** — anotado como sugestão |
| `refetchOnWindowFocus: false` | Volta pro app depois de horas com dado velho | Ligar `refetchOnReconnect`; avaliar `refetchOnWindowFocus` (barato agora que a maioria dos acessos é móvel) |
| Navegação inferior | Não existe | Ver Decisão #4 |

## Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | SW cacheia resposta autenticada por acidente numa mudança futura | Regra de exclusão explícita para `/api/`, comentada, e um teste que falha se `/api/*` aparecer em `caches` |
| R2 | Cache do TanStack Query já vaza entre usuários hoje | `queryClient.clear()` no logout — Etapa 28.1, antes de qualquer cache |
| R3 | SW antigo servindo bundle velho depois de um deploy | Versionar cache pelo build id, `skipWaiting` + aviso "nova versão disponível, recarregar" |
| R4 | Ícone maskable cortado (marca encostada na borda) | Zona segura de 80%; testar nos formatos círculo/gota/quadrado |
| R5 | Prompt de instalação insistente irritando quem não quer | Dispensa guardada; some em standalone |
| R6 | iOS não instala programaticamente, e a instrução manual passa despercebida | Instruções específicas quando detectar Safari iOS, sem botão falso |
| R7 | SW em desenvolvimento atrapalhando hot reload | Desabilitar o SW fora de produção (`disable: process.env.NODE_ENV !== 'production'`) |
| R8 | Subscription de push morta acumulando na tabela | Apagar no `404`/`410` do envio |
| R9 | Persistência em IndexedDB acabar gravando nota por engano numa mudança futura (uma chave de query nova entra sem ninguém reparar) | Lista de **permissão** explícita de chaves, nunca lista de bloqueio; teste que falha se algo fora da lista for gravado |

## Decisões propostas

| # | Pergunta | Proposta |
| --- | --- | --- |
| 1 | Cachear dado de API em disco? | **Sim, um recorte.** Disciplinas, provas, atividades e calendário são persistidos em IndexedDB pelo TanStack Query, por usuário. **Notas, boletim, estatísticas e histórico nunca** — alta sensibilidade, baixo valor offline. O Service Worker segue sem tocar em `/api/` |
| 2 | `start_url` | **`/dashboard`.** Quem instalou já tem sessão; cair na raiz e ser redirecionado piscaria a tela de login |
| 3 | `theme_color`/`background_color` | **Fixos no escuro** (`#0b0d12`). O manifest é lido pelo sistema operacional na instalação, não reage ao tema do app — um valor claro daria flash branco ao abrir no escuro |
| 4 | Navegação inferior no celular | **Sim, 6 itens**: Início, Turmas, Atividades, Provas, Notas, Mais. A gaveta continua existindo atrás de "Mais" — em standalone não há barra de endereço, e a navegação principal escondida atrás de um hambúrguer no topo fica longe do polegar. **Ressalva de densidade**: 6 itens num aparelho de 360px dão ~60px cada, então os rótulos precisam ser curtos ("Ativid." em vez de "Atividades") ou virar só ícone abaixo de um limite. Se ficar apertado no teste real, o candidato a sair é Notas — é a tela menos consultada no dia a dia das seis |
| 5 | Visão de Mês no calendário | **Manter, com ajuste de densidade** (mostrar só um marcador de cor por dia em vez do título do evento abaixo de `sm`). Trocar por lista destruiria a visão panorâmica, que é justamente pra que serve o Mês |
| 6 | Biblioteca | **`@serwist/next`** — uma dependência, de build |
| 7 | Push junto com o PWA? | **Sim, nesta rodada** — Etapas 28.11 e 28.12, depois de 28.1–28.10 estarem no ar. São as únicas etapas com tabela nova, chave secreta e dependência de cron, então ficam por último de propósito |
| 8 | Fila de escrita offline | **Não.** Conflito com a sincronização do Classroom, sem resolução de conflito no sistema |
| 9 | Flashcards voltam pra navegação? | **Não.** Continuam fora da nav; as rotas seguem funcionando, e o Plano de Estudos (item 27 do roadmap) vai acessá-los por dentro |

## Plano por etapas

Numeração seguindo o roadmap atual (o item 27 é o Plano de Estudos).

### Etapa 28.1 — Preparação e correção de segurança

**Objetivo.** Fechar o vazamento de cache no logout **antes** de qualquer
cache novo, e habilitar a área segura. **Banco.** Nenhuma. **Backend.**
Nenhum. **Frontend.** `queryClient.clear()` no logout e no
`onSessionExpired`; `viewportFit: 'cover'` no `viewport`; tokens de área
segura no `globals.css`; `refetchOnReconnect` no `QueryClient`.
**Riscos.** R2. **Testes.** Logar como A, navegar, sair, logar como B sem
recarregar — nenhum dado de A aparece. **Aceite.** Cache do Query zerado no
logout, verificável no devtools do TanStack Query.

### Etapa 28.2 — Web App Manifest

**Objetivo.** `app/manifest.ts` com os campos da tabela acima, mais
`appleWebApp` no `metadata`. **Banco.** Nenhuma. **Backend.** Nenhum.
**Frontend.** Um arquivo novo, um bloco no `layout.tsx`. **Riscos.** Nenhum.
**Testes.** Lighthouse → "Manifest válido"; DevTools → Application → Manifest
mostra nome, cores e `start_url` corretos. **Aceite.** Manifest servido em
`/manifest.webmanifest`, sem erro no Lighthouse.

### Etapa 28.3 — Ícones

**Objetivo.** `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`, com
paleta fixa. **Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** Arquivos
estáticos + referência no manifest. **Riscos.** R4. **Testes.** Instalar no
Android e conferir o recorte; [maskable.app](https://maskable.app) para
prever os formatos. **Aceite.** Ícone correto e não cortado na tela inicial
do Android e do desktop.

### Etapa 28.4 — Service Worker (cache de assets)

**Objetivo.** Serwist configurado, cacheando **só** estático, com a exclusão
explícita de `/api/`. **Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.**
`@serwist/next` no `next.config.ts`, `app/sw.ts`, desabilitado fora de
produção. **Riscos.** R1, R7. **Testes.** Build de produção; conferir em
DevTools → Application → Cache Storage que **nenhuma** entrada `/api/`
aparece, nem depois de navegar o app inteiro logado. **Aceite.** Segunda
visita carrega do cache; nenhuma resposta autenticada em disco.

### Etapa 28.5 — Página offline e indicador de conexão

**Objetivo.** Rota `/offline` pré-cacheada + faixa de "sem conexão".
**Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** Página nova, hook de
`online`/`offline`, fallback de navegação no SW. **Riscos.** Nenhum.
**Testes.** DevTools → Network → Offline; navegar para rota nunca visitada.
**Aceite.** App abre offline mostrando a página, com caminho de volta.

### Etapa 28.6 — Persistência de prazos em IndexedDB

**Objetivo.** Consultar disciplinas, provas, atividades e calendário sem
rede, e abrir o app instalado sem tela de carregamento. **Banco.** Nenhuma.
**Backend.** Nenhum. **Frontend.** Persistência do TanStack Query em
IndexedDB com uma **lista de permissão explícita de chaves de query** —
nunca o cache inteiro. A base é namespaceada pelo `userId`, apagada no
logout, e descartada no boot se o usuário logado não bater com o dono do
que está gravado. As telas que leem do disco mostram desde quando é o dado.
**Riscos.** R2 (mitigado por 28.1), R9. **Testes.** Trocar de usuário no
mesmo aparelho e inspecionar o IndexedDB; confirmar que **nenhuma** chave de
notas/estatísticas/histórico foi gravada; abrir offline e ver os prazos.
**Aceite.** Prazos disponíveis offline; nenhum dado de nota em disco;
IndexedDB vazio depois do logout.

### Etapa 28.7 — Experiência de instalação

**Objetivo.** Card "Instalar aplicativo" com as três condições de exibição, e
instruções específicas no iOS. **Banco.** Nenhuma. **Backend.** Nenhum.
**Frontend.** Hook de `beforeinstallprompt`, detecção de standalone, card no
Dashboard. **Riscos.** R5, R6. **Testes.** Chrome Android, Chrome desktop,
Safari iOS, Firefox desktop (não deve mostrar botão). **Aceite.** Botão só
aparece onde instalar é possível; some depois de instalado.

### Etapa 28.8 — Ajustes mobile e navegação inferior

**Objetivo.** Barra inferior de 6 itens (Início, Turmas, Atividades, Provas,
Notas, Mais), alvos de toque na gaveta, densidade do calendário Mês.
**Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** Componente novo de
navegação (visível só abaixo de `lg`), com padding de área segura no rodapé;
"Mais" abre a gaveta que já existe, com o que não coube. Ajustes pontuais no
`sidebar-nav.tsx` e no `MonthView`. **Riscos.** Regressão visual no desktop
(a barra não deve renderizar lá) e aperto de rótulo em 360px — ver ressalva
na Decisão #4. **Testes.** Larguras de 360px a 1440px; conferir que nenhum
rótulo quebra ou some; verificar que o desktop não muda. **Aceite.**
Navegação principal alcançável com o polegar em standalone, sem sobrepor o
indicador de gesto do sistema.

### Etapa 28.9 — Atualização do app

**Objetivo.** Detectar SW novo e avisar. **Banco.** Nenhuma. **Backend.**
Nenhum. **Frontend.** Listener de `waiting`, toast "Nova versão disponível —
Atualizar", `skipWaiting` + reload sob clique; limpeza de caches de versões
anteriores. **Riscos.** R3. **Testes.** Deploy, abrir app antigo, conferir o
aviso; garantir que a sessão sobrevive ao reload (o refresh token é cookie,
deve sobreviver). **Aceite.** Usuário atualiza sem limpar cache na mão e sem
ser deslogado.

### Etapa 28.10 — Testes e compatibilidade

**Objetivo.** Matriz de plataformas e a documentação em `docs/`. **Banco.**
Nenhuma. **Backend.** Nenhum. **Frontend.** Correções do que a matriz
apontar. **Riscos.** Nenhum. **Testes.** Ver a seção de testes abaixo.
**Aceite.** Instala e funciona offline em Chrome Android, Chrome desktop e
Safari iOS; documentação escrita.

### Etapa 28.11 — Push Notifications

**Objetivo.** Push ponta a ponta. **Banco.** Tabela `PushSubscription`
(`endpoint` único, `p256dh`, `auth`, `userAgent`, `userId`). **Backend.**
Chaves VAPID em variável de ambiente, `web-push`, endpoints de registro e
remoção, remoção automática no `404`/`410`, disparo pelo mesmo cron do
dígest de e-mail. **Frontend.** Pedido de permissão só sob ação explícita,
handler `push`/`notificationclick` no SW. **Riscos.** R8, permissão negada
para sempre se pedida cedo demais. **Testes.** Conceder, receber, clicar
(abre a tela certa), revogar, desinstalar. **Aceite.** Push chega no Android
instalado e no iOS 16.4+ instalado; desativar para de entregar.

### Etapa 28.12 — Tela de Configurações e preferências de notificação

**Objetivo.** Página `/configuracoes` (que não existe hoje) com preferências
por canal e por antecedência. **Banco.** A definir — colunas no `User` ou
tabela própria. **Backend.** Ligar o `PATCH /auth/me` que já existe e não tem
chamador. **Frontend.** Página nova; mover o tema pra lá e finalmente
persistir em `User.theme`. **Riscos.** Nenhum. **Testes.** Alterar, recarregar,
conferir persistência. **Aceite.** Preferências salvas no servidor e
respeitadas pelo disparo de push e e-mail.

## Testes

**Manuais, por plataforma:** Chrome Android (instalar, standalone, offline,
atualizar, desinstalar), Safari iOS (adicionar à tela inicial, standalone,
área segura no notch), Chrome e Edge desktop (instalar, janela própria),
Firefox desktop (confirmar degradação limpa — sem botão de instalar, app
funcionando normal).

**Por cenário:** online; offline total; rede instável (DevTools → Slow 3G);
login; logout; **troca de usuário no mesmo aparelho** (o mais importante);
deploy no meio de uma sessão aberta.

**Automatizáveis** (o que vale o esforço):

- Lighthouse PWA em CI — pega manifest quebrado e SW não registrado de graça.
- Um teste que navega logado, lê `caches.keys()`/`caches.match` e **falha se
  qualquer entrada `/api/` existir**. É a rede de segurança do R1.
- Um teste que navega logado por todas as telas e **falha se o IndexedDB
  contiver qualquer chave fora da lista de permissão** — em especial nota,
  boletim, estatística ou histórico. É a rede de segurança do R9, e o mais
  importante dos três: é o que impede uma chave de query nova entrar no
  disco sem ninguém reparar.

O resto (instalação, notificação push, comportamento do iOS) depende de
aparelho real e não vale automatizar.

## Documentação

Ao concluir, criar `docs/pwa.md` cobrindo arquitetura do SW, estratégia de
cache com o **porquê** da exclusão de `/api/`, fluxo de atualização e
segurança; e, se a Etapa 28.11 acontecer, `docs/push-notifications.md` com
VAPID, ciclo de vida das subscriptions e limitações do iOS. No `README.md`,
só uma linha na lista de funcionalidades — o detalhe fica em `docs/`, no
padrão que o projeto acabou de adotar.

## Perguntas em aberto

Quatro das cinco perguntas da análise foram respondidas e viraram as
Decisões #1, #4, #7 e #9. Resta uma, que não bloqueia o começo:

1. **Existe algum aparelho iOS disponível para teste?** Boa parte das
   limitações de PWA no iOS (área segura no notch, standalone, Web Push só
   com o app instalado) não dá pra verificar sem um — e sem verificar, é
   chute. Se não houver, as etapas 28.3, 28.7 e 28.11 entregam a parte do
   iOS "no melhor esforço", e isso precisa estar claro no aceite delas.
