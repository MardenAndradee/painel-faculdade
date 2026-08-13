# Painel Faculdade

Plataforma web de organização acadêmica para estudantes universitários. Centraliza atividades, provas, notas, materiais e cronograma de estudos em um único lugar, com integração ao Google Classroom e ao Google Calendar.

> **Status:** 24 de 25 etapas concluídas — Etapa 25 planejada (envio de e-mail), pronta para implementar.

---

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Identidade visual](#identidade-visual)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Google OAuth](#google-oauth)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Autenticação](#autenticação)
- [Autenticação: e-mail + senha (planejado)](#autenticação-e-mail--senha-planejado)
- [Dashboard](#dashboard)
- [Disciplinas](#disciplinas)
- [Atividades](#atividades)
- [Provas](#provas)
- [Calendário](#calendário)
- [Google Classroom](#google-classroom)
- [Google Calendar](#google-calendar)
- [Notas](#notas)
- [Histórico](#histórico)
- [Materiais](#materiais)
- [Flashcards](#flashcards)
- [Cronograma](#cronograma)
- [Estatísticas](#estatísticas)
- [Turmas (planejado)](#turmas-planejado)
- [Banco de dados](#banco-de-dados)
- [Scripts](#scripts)
- [Testes](#testes)
- [Docker](#docker)
- [Deploy (Docker)](#deploy-docker)
- [Deploy (Vercel + Neon + R2)](#deploy-vercel--neon--r2)
- [Padrões de código](#padrões-de-código)
- [Roadmap](#roadmap)

---

## Stack

| Camada        | Tecnologias                                                              |
| ------------- | ------------------------------------------------------------------------ |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, cmdk |
| Estado/dados  | TanStack Query, React Hook Form, Zod                                     |
| Backend       | Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL 18                  |
| Autenticação  | Google OAuth2, JWT, Refresh Token                                        |
| Ferramentas   | Docker, Docker Compose, ESLint 10, Prettier, Husky, lint-staged          |

## Arquitetura

Monorepo com **npm workspaces** e três pacotes:

```
@painel/api      Backend Express
@painel/web      Frontend Next.js
@painel/shared   Schemas Zod, enums e tipos compartilhados
```

### Por que um pacote compartilhado

Os schemas Zod vivem em `@painel/shared` e são consumidos **pelos dois lados**: os `validators/` do Express e o React Hook Form no Next. Uma única fonte de verdade — o formulário nunca aceita algo que a API rejeita, e mudar uma regra de validação é mudar um arquivo.

### Fluxo de camadas no backend

```
Request → Route → Middleware (auth, validate) → Controller → Service → Repository → Prisma
```

Regras invioláveis:

- **Controllers** traduzem HTTP: leem a requisição validada, chamam o service, devolvem a resposta. Nenhuma regra de negócio.
- **Services** concentram toda a regra de negócio. Não conhecem `req`/`res` — são testáveis sem subir servidor.
- **Repositories** são a única camada que importa o Prisma. Trocar a forma de persistir não vaza para o resto.
- **Validators** definem os schemas Zod das rotas, reexportando de `@painel/shared`.

### Decisões relevantes

| Decisão                                     | Motivo                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Assignment` única com `source`              | Atividades manuais e do Classroom aparecem nas mesmas listas, filtros, calendário e estatísticas. Tabelas separadas exigiriam `UNION` em toda consulta. |
| Express 5 sem `asyncHandler`                 | O Express 5 propaga rejeições de promise ao error handler nativamente.                                                                          |
| `Float` para notas                           | Notas têm precisão baixa (0–10). `Decimal` obrigaria conversão manual em toda resposta JSON sem ganho real.                                     |
| Refresh tokens em tabela própria             | Permite múltiplas sessões simultâneas e revogação por dispositivo.                                                                              |
| Access token em memória, refresh em cookie   | `localStorage` é legível por XSS; cookie `httpOnly` não. Ver [Autenticação](#autenticação).                                                     |
| Escopos do Google pedidos por etapa          | No login só `openid/email/profile`. Classroom e Calendar entram quando o usuário aciona a sincronização.                                        |
| Dashboard num único endpoint agregado        | Seis chamadas na primeira tela custam seis round-trips; as consultas rodam em paralelo no servidor.                                             |
| Limite separado para `/auth/refresh`         | Renovação ocorre a cada carregamento de página — o limite de login (20/15min) deslogaria quem usa o sistema normalmente.                        |
| Excluir disciplina arquiva por padrão        | `Exam` e `Grade` são apagados em cascata; a exclusão definitiva exige confirmação com o impacto à vista.                                        |
| `booleanQueryParam` em vez de `z.coerce.boolean` | `Boolean("false")` é `true` — em `?permanent=false` isso apagaria dados que deveriam ser arquivados.                                        |
| Env validado com Zod no boot                 | Falha imediata e legível, em vez de erro em produção na primeira requisição que tocar a variável ausente.                                       |
| Project references do TypeScript             | `api` e `web` consomem os `.d.ts` de `shared` sem violar o `rootDir` de cada app.                                                               |

## Estrutura de pastas

```
painel-faculdade/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # 17 entidades + enums
│   │   │   ├── migrations/
│   │   │   └── seed.ts              # dados de desenvolvimento (idempotente)
│   │   ├── prisma.config.ts         # config do Prisma CLI (Prisma 7)
│   │   └── src/
│   │       ├── config/              # env, prisma, logger
│   │       ├── controllers/         # camada HTTP
│   │       ├── services/            # regra de negócio
│   │       ├── repositories/        # acesso a dados
│   │       ├── middlewares/         # erro, validação, rate limit, auth
│   │       ├── routes/              # registro de rotas
│   │       ├── validators/          # schemas Zod das rotas
│   │       ├── utils/               # AppError, helpers de resposta
│   │       ├── app.ts               # montagem do Express
│   │       └── server.ts            # bootstrap e shutdown
│   └── web/
│       ├── app/                     # App Router (+ icon.svg, apple-icon.png)
│       ├── components/              # componentes reutilizáveis (+ ui/ do shadcn)
│       ├── hooks/                   # hooks de dados (TanStack Query)
│       ├── services/                # cliente HTTP da API
│       ├── contexts/  providers/    # auth, tema
│       ├── types/  lib/
│       └── globals.css              # design tokens (light/dark)
├── packages/shared/src/             # enums, schemas Zod, tipos de API
├── docker-compose.yml
└── package.json                     # workspaces + scripts
```

## Identidade visual

A marca é um **SVG inline** (`apps/web/components/brand/logo.tsx`), não um arquivo de imagem. Ela aparece de 28px na sidebar a 56px no login e precisa acompanhar o tema claro/escuro — como vetor no DOM ela escala sem perda e troca de cor pelos tokens, sem duas versões do mesmo arquivo nem troca de `src` na hidratação.

| Export | Uso |
| --- | --- |
| `LogoMark` | Só o símbolo, para onde não cabe o nome por extenso |
| `Logo` | Lockup horizontal: símbolo + nome |

O nome é **texto de verdade**, não `<text>` dentro do SVG: assim herda a Inter carregada pelo `next/font` (dentro do SVG a família teria de ser repetida à mão, e o nome que o `next/font` gera é um hash), continua selecionável e legível por leitor de tela, e reescala com a tipografia da página. Quando o nome aparece ao lado, o símbolo vira `aria-hidden` — do contrário o leitor de tela anunciaria a marca duas vezes.

### As cores da marca são tokens próprios

`--brand-mark-*` e `--brand-wordmark` vivem em `globals.css` **separados dos tokens de UI**, com uma versão para cada tema. Amarrá-los a `--primary` faria a marca mudar de cor junto com qualquer ajuste de tema, e uma logo precisa ser a mesma coisa onde quer que apareça.

### Ícones

`app/icon.svg` e `app/apple-icon.png` seguem a convenção de arquivos do App Router — o Next emite os `<link>` sozinho, sem configuração em `metadata`.

O favicon usa a variante do manual para tamanhos pequenos: símbolo branco sobre o azul da marca, **sem** o painel inferior e sem o ponto. A 16px esses dois detalhes viram sujeira; o que precisa sobreviver é a silhueta do "P". O ícone do iOS usa a marca completa sobre fundo escuro, sem cantos arredondados — o próprio sistema aplica a máscara.

## Pré-requisitos

- **Node.js** ≥ 20.19 (testado em 20.20)
- **PostgreSQL** 18 — local ou via Docker
- **Docker** e **Docker Compose** — opcional, apenas se preferir subir o banco em container

## Instalação

```bash
git clone <url-do-repositorio>
cd painel-faculdade

npm install

# Arquivos de ambiente
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### Gerar os segredos JWT

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
```

Cole os valores em `apps/api/.env`. Os dois **precisam ser diferentes** e ter no mínimo 32 caracteres — a validação de ambiente recusa o boot caso contrário.

### Criar o banco (PostgreSQL local)

```bash
psql -d postgres -c "CREATE ROLE painel WITH LOGIN PASSWORD 'painel_dev_password' CREATEDB;"
psql -d postgres -c "CREATE DATABASE painel_faculdade OWNER painel;"
```

Usando Docker em vez do Postgres local, pule este passo e ajuste a porta para `5433` em `DATABASE_URL`.

### Preparar o banco e subir

```bash
npm run db:migrate      # aplica as migrations
npm run db:seed         # popula dados de desenvolvimento
npm run dev             # sobe shared (watch) + API + Web
```

| Serviço | URL                              |
| ------- | -------------------------------- |
| Web     | http://localhost:3000            |
| API     | http://localhost:3333/api/v1     |
| Health  | http://localhost:3333/api/v1/health |

Para rodar isoladamente: `npm run dev:api` e `npm run dev:web`.

## Google OAuth

Sem estas credenciais o login não funciona (o restante da aplicação sobe normalmente).

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto.
2. Em **APIs e Serviços → Tela de permissão OAuth**, escolha **Externo** e preencha nome do app e e-mail de suporte.
3. Ainda na tela de permissão, adicione seu e-mail em **Usuários de teste** — enquanto o app não for publicado, só eles conseguem entrar.
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
5. Configure exatamente:

   | Campo | Valor |
   | --- | --- |
   | Origens JavaScript autorizadas | `http://localhost:3000` |
   | URIs de redirecionamento autorizados | `http://localhost:3333/api/v1/auth/google/callback` |

6. Copie o ID e o secret para `apps/api/.env`:

   ```env
   GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="..."
   ```

> O URI de redirecionamento aponta para a **API** (porta 3333), não para o frontend. A troca do código por tokens acontece no servidor, onde o `client_secret` fica protegido.

Nas Etapas 8 e 9, quando as APIs do Classroom e do Calendar forem usadas, será preciso habilitá-las na biblioteca de APIs do mesmo projeto.

## Variáveis de ambiente

### `apps/api/.env`

| Variável                 | Obrigatória | Padrão                  | Descrição                                             |
| ------------------------ | ----------- | ----------------------- | ----------------------------------------------------- |
| `NODE_ENV`               | não         | `development`           | `development` \| `test` \| `production`               |
| `PORT`                   | não         | `3333`                  | Porta da API                                          |
| `DATABASE_URL`           | **sim**     | —                       | String de conexão do PostgreSQL                       |
| `JWT_ACCESS_SECRET`      | **sim**     | —                       | Segredo do access token (mín. 32 caracteres)          |
| `JWT_REFRESH_SECRET`     | **sim**     | —                       | Segredo do refresh token (mín. 32 caracteres)         |
| `JWT_ACCESS_EXPIRES_IN`  | não         | `15m`                   | Validade do access token                              |
| `JWT_REFRESH_EXPIRES_IN` | não         | `7d`                    | Validade do refresh token                             |
| `GOOGLE_CLIENT_ID`       | para login  | `''`                    | Credencial do Google OAuth2                           |
| `GOOGLE_CLIENT_SECRET`   | para login  | `''`                    | Credencial do Google OAuth2                           |
| `GOOGLE_REDIRECT_URI`    | não         | `.../auth/google/callback` | Callback do OAuth                                  |
| `WEB_APP_URL`            | não         | `http://localhost:3000` | URL do frontend                                       |
| `CORS_ORIGINS`           | não         | `http://localhost:3000` | Origens permitidas, separadas por vírgula             |
| `RATE_LIMIT_WINDOW_MS`   | não         | `900000`                | Janela do rate limit (15 min)                         |
| `RATE_LIMIT_MAX`         | não         | `300`                   | Requisições por janela                                |
| `UPLOAD_DIR`             | não         | `./uploads`             | Destino dos materiais enviados                        |
| `MAX_UPLOAD_SIZE_MB`     | não         | `25`                    | Tamanho máximo por arquivo                            |
| `LOG_LEVEL`              | não         | `info`                  | `debug` \| `info` \| `warn` \| `error`                |

> **Em produção todas passam a ser obrigatórias.** A composição de produção usa
> `${VAR:?}`, então o `docker compose` falha imediatamente — e com o nome da
> variável faltante — em vez de subir um contêiner que só quebraria na primeira
> requisição.

### `apps/web/.env.local`

| Variável               | Padrão                         | Descrição                        |
| ---------------------- | ------------------------------ | -------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3333/api/v1` | Endpoint da API                  |
| `NEXT_PUBLIC_APP_NAME` | `Painel Faculdade`             | Nome exibido na interface        |

## Autenticação

### Fluxo de login

```
Browser  →  GET  /auth/google           → redireciona ao consentimento do Google
Google   →  GET  /auth/google/callback  → valida state, troca code por tokens,
                                          redireciona levando o refresh token
                                          no FRAGMENTO da URL (#session=...)
Browser  →  POST /auth/session          → troca o token do fragmento pela sessao;
                                          o cookie httpOnly e gravado AQUI
Browser  →  POST /auth/refresh          → recarregamentos seguintes: recebe o
                                          access token no corpo, a partir do cookie
```

O access token **nunca trafega pela URL** em nenhuma etapa. Passá-lo por query string o exporia no histórico do navegador, nos logs de acesso do servidor e no header `Referer`.

O refresh token, por sua vez, viaja no **fragmento** (`#session=...`) só entre o callback e `/auth/callback` no frontend — o fragmento nunca chega a nenhum servidor (nem ao nosso, nem a um proxy, nem a um log de acesso), e o frontend o remove da barra de endereços assim que lê.

**Por que o cookie não é gravado direto no redirecionamento do callback.** Essa era a implementação original, e funciona em Chrome/Firefox — mas o Safari (ITP) limita a validade de cookies gravados numa resposta de redirecionamento logo após uma navegação vinda de outro site (o Google, nesse caso), *ignorando silenciosamente* o `Max-Age` configurado. Na prática, a sessão parecia expirar em menos de 7 dias sem nenhum erro visível, e o usuário era deslogado com frequência — especialmente perceptível num PWA adicionado à tela de início do iOS. `POST /auth/session` existe só para fugir desse padrão: troca o token do fragmento pela sessão através de um `fetch` comum, fora de qualquer cadeia de redirecionamento, onde o cookie é gravado com a validade correta. A rotina de validação é a mesma do `/auth/refresh` — o token do callback é tratado como um refresh token igual a qualquer outro.

### Onde cada token fica

| Token | Local | Validade | Motivo |
| --- | --- | --- | --- |
| Access | Memória (React Context) | 15 min | `localStorage` é legível por qualquer script injetado |
| Refresh | Cookie `httpOnly`, `SameSite`, `path=/api/v1/auth` | 7 dias | Fora do alcance do JavaScript — imune a XSS |

Recarregar a página descarta o access token; o `AuthProvider` o recupera silenciosamente pelo cookie. A renovação também acontece de forma proativa, 1 minuto antes de expirar.

### Rotação e detecção de reuso

Cada `POST /auth/refresh` revoga o token apresentado e emite um novo. Se um token **já revogado** reaparecer, isso indica roubo: todas as sessões daquele usuário são derrubadas. O banco guarda somente o hash SHA-256 — o valor puro nunca é persistido.

### Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/auth/google` | — | Inicia o fluxo OAuth |
| GET | `/auth/google/callback` | — | Retorno do Google |
| POST | `/auth/session` | — | Troca o token do fragmento do callback pela sessão (grava o cookie) |
| POST | `/auth/refresh` | cookie | Rotaciona a sessão e devolve o access token |
| POST | `/auth/logout` | cookie | Encerra a sessão atual |
| GET | `/auth/me` | Bearer | Perfil do usuário |
| PATCH | `/auth/me` | Bearer | Atualiza nome, tema e fuso |
| POST | `/auth/logout-all` | Bearer | Encerra todas as sessões |
| GET | `/dashboard/summary` | Bearer | Resumo agregado do dashboard |

O início de sessão usa rate limit estrito (20 req / 15 min); `/auth/refresh` tem limite próprio e mais folgado (120 req / 15 min), por ser chamado a cada carregamento de página.

### Proteção de rotas no frontend

Tudo sob o grupo `app/(app)/` passa pelo `AuthGuard`, que aguarda a restauração da sessão antes de renderizar. Não usamos `middleware.ts` do Next para isso: como o cookie tem `path=/api/v1/auth`, ele não é enviado ao servidor do Next — consequência deliberada de restringir o alcance do cookie.

## Autenticação: e-mail + senha (planejado)

> **Só plano — nenhum código, migration ou schema foi alterado nesta etapa.**
> Este documento é a Etapa 1 (análise) já resolvida, mais arquitetura,
> modelagem, fluxos, riscos e um plano por etapas. As decisões em aberto
> foram todas respondidas (ver "Decisões" abaixo) — falta só o sinal final
> pra começar a implementar.

### Objetivo

Hoje o único jeito de entrar é "Continuar com Google" (seção "## Autenticação"
acima). Passar a aceitar **e-mail + senha**, com os dois métodos podendo
representar o **mesmo usuário** quando vinculados — nunca dois `User`
diferentes pra uma pessoa só.

### O que a análise encontrou (Etapa 1)

Pontos do sistema atual que **restringem** o desenho da solução:

| Onde | O que é hoje | Por que importa pro plano |
| --- | --- | --- |
| `User.googleId` | `String @unique`, **obrigatório** | Todo usuário existente tem um. Não pode virar "e-mail OU senha OU google" sem abrir espaço pra usuário sem `googleId` |
| `User.email` | `String @unique` | Continua sendo a chave humana da conta — os dois métodos apontam pro mesmo e-mail |
| Identidade do Google | `payload.sub` (`googleId`), **nunca o e-mail** (`apps/api/src/config/google.ts:112`) | O projeto já faz a coisa certa aqui — só precisa mover de coluna do `User` pra uma tabela própria |
| `googleAccessToken`/`googleRefreshToken`/`googleTokenExpiry`/`googleGrantedScopes` | Colunas do `User`, lidas por `integration.service.ts` pra sincronizar Classroom/Calendar | **Não são identidade — são credencial de integração.** Não precisam (e não devem) mudar de lugar |
| Sessão (access/refresh JWT, cookie httpOnly, rotação com detecção de reuso) | `auth.service.ts` / `jwt.ts` / `cookies.ts` | Já é sólido — o plano **reaproveita inteiro**, só troca o que autentica antes de chamar `issueSession()` |
| Proteção de rota | `AuthGuard` no frontend (client-side), sem `middleware.ts` | Sem mudança — continua igual pros dois métodos |
| Rate limit de login | `authRateLimiter`, 20 req/15min **por IP**, só no fluxo Google hoje | Senha precisa de limite **por IP e por conta** — força bruta distribuída (várias origens, uma conta) escapa de um limite só por IP |
| Hash de senha | Não existe (`bcrypt`/`argon2` não estão instalados) | Zero legado pra migrar — decisão limpa |
| Envio de e-mail | Não existe ainda (ver "Etapa 25 — Envio de e-mail", planejada, não implementada) | Verificação de e-mail e recuperação de senha **dependem** dela — ver riscos |
| Desconectar Classroom/Calendar | Já são ações **próprias e independentes** (`DELETE /integrations/classroom`, `DELETE /integrations/calendar`) | Desvincular o Google como MÉTODO DE LOGIN é uma terceira ação, separada dessas duas — não mexe no acesso ao Classroom/Calendar |

### Arquitetura: `User` + `AuthIdentity`

**Sim, separar é a decisão certa pra este projeto**, pelo motivo que a stack
já demonstra em outro lugar: o padrão "registro canônico + o que aponta pra
ele" é o mesmo usado em Turmas (`Class` + `ClassMember`) e em Publicações
(`ClassPost` + `ClassPostCopy`). Aqui o "registro canônico" é a pessoa
(`User`), e cada jeito dela provar quem é (senha, Google, e no futuro
Microsoft/Apple se algum dia fizer sentido) é uma linha que aponta pra ela.

```
User
  id, name, email (único), passwordHash?, emailVerifiedAt?
  ... (todos os campos e relações atuais, sem mudança)
  googleAccessToken / googleRefreshToken / googleTokenExpiry / googleGrantedScopes
  → CONTINUAM AQUI: são credencial de integração (Classroom/Calendar), não
    identidade de login. integration.service.ts não muda uma linha.

AuthIdentity
  id, provider (enum, hoje só GOOGLE), providerAccountId, userId, createdAt
  @@unique([provider, providerAccountId])  -- essa conta Google só pode apontar pra 1 User
  @@unique([userId, provider])             -- 1 User só tem 1 Google vinculado
```

Por que `providerAccountId` e nunca o e-mail (exatamente como pedido): o
Google permite trocar o e-mail de uma conta; se a chave fosse o e-mail, essa
troca faria o sistema "perder" o vínculo com o histórico do usuário. O
projeto **já faz isso certo hoje** (`googleId = payload.sub`) — a mudança é
só de *onde* mora essa coluna, não da regra em si.

**Por que a senha não vira uma `AuthIdentity`.** `AuthIdentity` existe pra
identidades de **terceiros** (OAuth) — provider + id de conta de outro
sistema. Senha não é isso: é intrínseca ao `User`, então
`passwordHash`/`emailVerifiedAt` ficam direto nele, do jeito que o próprio
pedido já esboçou.

**O que propositalmente NÃO muda:** `googleAccessToken`, `googleRefreshToken`,
`googleTokenExpiry`, `googleGrantedScopes`, `classroomSyncedAt`,
`calendarSyncedAt` continuam no `User`. São o crachá de acesso às APIs do
Classroom/Calendar, não a prova de identidade — mover isso pra
`AuthIdentity` obrigaria a reescrever `integration.service.ts` sem nenhum
ganho real, e o pedido explícito é **não quebrar essa integração**.

### Modelagem (schema proposto — só documentado, não aplicado)

```prisma
enum AuthProvider {
  GOOGLE
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  avatarUrl     String?

  /// Nulo pra quem só usa Google. Nunca em texto puro - hash argon2id.
  passwordHash    String?
  /// Nulo = e-mail nunca confirmado. Setado automaticamente no cadastro via
  /// Google (o Google já verifica), manualmente no fluxo de verificação
  /// pro cadastro por senha.
  emailVerifiedAt DateTime?
  /// Setado no PRIMEIRO login por senha bem-sucedido, nunca mais tocado.
  /// Distingue "a pessoa já provou que sabe a senha" de "só o e-mail foi
  /// confirmado" - a diferença que fecha o risco R1 por completo (ver
  /// "Riscos" e Fluxo 3/4). Nulo = senha nunca comprovada; se um auto-link
  /// do Google acontecer nesse estado, a senha é invalidada no ato.
  passwordClaimedAt DateTime?

  /// DEPRECADO - mantido indefinidamente como rede de segurança (Decisões,
  /// item 4), sem leitura nenhuma depois que `AuthIdentity` vira fonte da
  /// verdade (Etapa 3). Sem prazo de remoção definido.
  googleId String? @unique

  // ... todos os campos e relações atuais continuam exatamente iguais ...
  googleAccessToken   String?   @db.Text
  googleRefreshToken  String?   @db.Text
  googleTokenExpiry   DateTime?
  googleGrantedScopes String[]  @default([])

  authIdentities AuthIdentity[]
  passwordResetTokens EmailToken[]

  @@map("users")
}

model AuthIdentity {
  id                String       @id @default(cuid())
  provider          AuthProvider
  /// `sub` do Google - nunca o e-mail (ver "Arquitetura").
  providerAccountId String

  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@unique([userId, provider])
  @@map("auth_identities")
}

enum EmailTokenPurpose {
  VERIFY_EMAIL
  RESET_PASSWORD
}

/// Token de uso único enviado por e-mail (Etapas 4 e 9) - mesmo padrão de
/// hash já usado em `RefreshToken`/`ClassInvite`: só o hash é persistido.
model EmailToken {
  id        String            @id @default(cuid())
  purpose   EmailTokenPurpose
  tokenHash String            @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime          @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
  @@map("email_tokens")
}
```

### Fluxos

**1 — Cadastro normal.** `POST /auth/register` (nome, e-mail, senha) → e-mail
já em uso? `409`. Não → hash da senha (`argon2id`), cria `User` (sem
`AuthIdentity`, `emailVerifiedAt: null`) → emite sessão igual a hoje
(`issueSession`, mesmo cookie/JWT) → dashboard, sem esperar verificação
(Decisões, item 1). Dispara e-mail de verificação em paralelo, sem bloquear
o login; até verificar, a conta fica fora do auto-link do Fluxo 3/4 (R1).

**2 — Login normal.** `POST /auth/login` (e-mail, senha) → busca `User` por
e-mail → `passwordHash` nulo (conta só-Google) ou senha não bate → **mesma
mensagem genérica** nos dois casos ("e-mail ou senha inválidos") — dizer
"esta conta usa Google" a quem não provou a senha é enumeração de usuário →
bate → `issueSession()` → dashboard.

**3 — Novo usuário com Google** e **4 — Google já vinculado** são o MESMO
código (`loginWithGoogle` de hoje, adaptado):

```
Google OAuth → identidade validada (payload.sub, email_verified obrigatório)
  → AuthIdentity(GOOGLE, sub) existe?
      SIM → User dela → login (Fluxo 4)
      NÃO → User com este e-mail já existe?
              SIM → cria AuthIdentity apontando pra ele → login
                    (é o exemplo do pedido: marden@gmail.com já existe,
                    Google com o mesmo e-mail LINKA, não duplica)
              NÃO → cria User + AuthIdentity (Fluxo 3, igual a hoje)
```

O auto-link por e-mail é automático (Decisões, item 2). Duas camadas o
protegem contra o risco R1 (*pre-hijacking* — ver "Riscos"): o Google **já
verificou** esse e-mail (`email_verified`, checado hoje em `google.ts:106`);
a conta local correspondente precisa ter o dela confirmado
(`emailVerifiedAt` não nulo) pra ser candidata ao link. E, como a verificação
sozinha não prova que a senha da conta pertence a quem clicou no e-mail (só
prova que o e-mail chegou), o link **invalida a senha existente** se ela
nunca foi usada num login bem-sucedido antes — só nesse caso específico,
nunca quando a própria pessoa já provou a senha alguma vez.

**5 — Vincular Google numa conta já logada.** Sempre autenticado
(`Bearer` válido). `POST /auth/me/link/google` → mesma tela de consentimento
→ e-mail do Google bate com o e-mail do usuário **logado**? Sim → cria
`AuthIdentity`. Não → Fluxo 6.

**6 — Google com e-mail diferente.** Bloqueado, sempre — nunca vincula
silenciosamente. Mensagem clara: "Esta conta Google usa outro e-mail
(...); entre com a conta certa ou vincule depois de trocar seu e-mail
aqui." Vale tanto pra alguém tentando vincular pelo Configurações quanto,
por segurança, como regra geral de qualquer vínculo.

**7 — Google já vinculado a outro usuário.** `AuthIdentity` tem
`@@unique([provider, providerAccountId])` — o banco já impede duas linhas
pra mesma conta Google. O service traduz a violação em `409` claro: "esta
conta Google já está vinculada a outro usuário do Painel."

### Métodos de login (Configurações → Conta)

Superfície nova (não existe tela de Configurações hoje — ver Etapa 25, que
cogitou o mesmo toggle solto no menu do usuário; os dois cabem juntos nesta
tela quando ela existir).

```
GET /auth/me/login-methods
  → { hasPassword: boolean, linkedProviders: ['google'?] }

POST   /auth/me/link/google      -- Fluxo 5
DELETE /auth/me/link/google      -- desvincula (com a trava abaixo)
POST   /auth/me/password         -- "Adicionar senha" (conta só-Google)
PATCH  /auth/me/password         -- trocar senha (pede a senha atual)
```

**Nunca remover o último método válido.** `DELETE /auth/me/link/google`
checa `passwordHash !== null` antes de apagar a `AuthIdentity`; senha sem
Google vinculado não tem o que remover (não há "desvincular senha", só
trocar). Uma conta sem NENHUM jeito de entrar é uma conta perdida.

### Riscos

| # | Risco | Mitigação proposta |
| --- | --- | --- |
| R1 | **Sequestro por "ocupação" de e-mail** (categoria conhecida como *pre-hijacking*): alguém cadastra `victim@gmail.com` com senha (sem ser dono da caixa); depois a vítima real usa "Continuar com Google" com o e-mail dela → o auto-link (Fluxo 3/4) linkaria a conta Google real à conta senha do atacante | Base: `emailVerifiedAt` exigido antes de elegível pro auto-link (fecha o caso ingênuo — ninguém nunca verificou). **Refinamento que fecha o caso completo:** só tratar a senha como "reivindicada pelo dono de verdade" depois do PRIMEIRO login por senha bem-sucedido; se o Google linkar numa conta cujo e-mail foi verificado mas cuja senha **nunca** foi usada pra entrar, invalidar essa senha no ato do link e avisar por e-mail ("sua senha foi redefinida por segurança") — fecha a janela mesmo se o atacante induzir a vítima a clicar no link de verificação. Ver nota abaixo dos Fluxos: proponho como parte da Etapa 6, não como extra opcional |
| R2 | Força bruta distribuída (várias origens, mesma conta) escapando do rate limit por IP | Limite **por conta** além do por IP — contador de tentativas falhas + bloqueio temporário em `User`, não só `express-rate-limit` |
| R3 | Enumeração de usuário via mensagens diferentes ("e-mail não existe" vs "senha errada", ou "e-mail enviado" só quando a conta existe) | Mensagem genérica sempre — login (Fluxo 2) e "esqueci a senha" (Etapa 9) nunca revelam se o e-mail existe |
| R4 | Senha fraca | Política simples (comprimento mínimo, sem regra de complexidade artificial — orientação atual do NIST é comprimento > complexidade forçada) |
| R5 | Migração perder ou duplicar usuário existente | Backfill em duas fases (Etapa 3): criar+conferir `AuthIdentity` ANTES de qualquer leitura mudar de fonte; `User.id` nunca muda, então toda FK do sistema (dezenas de tabelas) permanece intacta o tempo todo |
| R6 | Recuperação de senha depende de e-mail, que ainda não existe (Etapa 25 não implementada) | Etapa 9 entra no plano (Decisões, item 5); implementação real fica bloqueada até a Etapa 25 (ou um provedor mínimo, só pra isso) estar pronta — mesmo espírito da Etapa 25 em si |
| R7 | `argon2id` nativo em ambiente serverless (Vercel) | Prisma já exige runtime Node (não Edge) nas functions da API, então módulo nativo funciona pelo mesmo motivo que `@prisma/client` já funciona; confirmar no deploy da Etapa 4 que o binário prebuilt do `argon2` cobre o runtime da Vercel — se der problema de build, `bcrypt`/`bcryptjs` ficam como plano B sem redesenhar nada além da função de hash |

### Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Cadastro por senha entra logo autenticado, ou espera verificação de e-mail? | **Loga na hora** (fricção baixa). A conta fica "não verificada" e continua **fora** da comparação de auto-link do Fluxo 3/4 até verificar (R1) — um Google com esse e-mail, enquanto isso, cai no fluxo de "conta nova" com aviso de e-mail já cadastrado, não linka sozinho |
| 2 | Vínculo automático por e-mail, sem tela de confirmação? | **Sim, automático** — sem etapa extra de confirmação, exatamente como no pedido original, respeitando a trava do item 1 (só linka conta já verificada) |
| 3 | `bcrypt` ou `argon2id`? | **`argon2id`** — recomendação atual do OWASP; ver R7 pro risco de deploy e o plano B |
| 4 | Remover `User.googleId` já, ou manter? | **Mantém** — fica como coluna deprecada, sem leitura, sem prazo definido de remoção |
| 5 | Etapa 9 (recuperação de senha) entra no plano? | **Sim** — mesmo dependendo da Etapa 25 (R6); a implementação fica *code-complete* e só liga de verdade quando o envio de e-mail existir |

### Plano por etapas

#### Etapa 1 — Análise da autenticação atual ✅

Já feita — é este documento até aqui (seção "O que a análise encontrou").

#### Etapa 2 — Modelagem `User` + `AuthIdentity`

**Objetivo.** Schema pronto, sem mudar nenhum comportamento.
**Banco.** Migration aditiva: `AuthIdentity`, `EmailToken`, `AuthProvider`,
`EmailTokenPurpose`; `User` ganha `passwordHash?`, `emailVerifiedAt?` (tudo
opcional — nenhuma linha existente é afetada). `googleId` continua como
está, sem tocar.
**Backend.** Só o client do Prisma regenerado; nenhum service muda.
**Frontend.** Nada.
**Riscos.** Baixo — é só schema novo ao lado do que já existe.
**Testes.** Migration aplica limpo num banco com dados reais (cópia de
produção ou seed representativo).
**Aceite.** App sobe normal, login com Google continua idêntico a hoje.

#### Etapa 3 — Migração dos usuários existentes

**Objetivo.** Todo `User` atual ganha a `AuthIdentity` correspondente, sem
perder nem duplicar ninguém.
**Banco.** Migration de dado (SQL): `INSERT INTO auth_identities (id,
provider, "providerAccountId", "userId", "createdAt") SELECT
gen_random_uuid()::text, 'GOOGLE', "googleId", id, now() FROM users WHERE
"googleId" IS NOT NULL`. Roda dentro de uma transação; confere
`COUNT(users) = COUNT(auth_identities)` antes de seguir.
**Backend.** `loginWithGoogle` passa a resolver por `AuthIdentity` (Fluxos
3/4); `googleId` para de ser escrito, mas a coluna **continua existindo**
(não lida por ninguém) até a limpeza posterior — rede de segurança barata.
**Frontend.** Nada.
**Riscos.** O único item deste plano inteiro que toca dado de usuário
real — por isso é etapa própria, isolada de qualquer outra mudança, com
teste de contagem antes/depois obrigatório.
**Testes.** Rodar contra um snapshot do banco atual (ou staging com dados
reais): todo usuário existente continua logando com a MESMA conta depois da
migração — sem `User` novo criado nem sessão de ninguém invalidada.
**Aceite.** 100% dos usuários com `googleId` têm exatamente 1
`AuthIdentity`; login de conta antiga funciona sem diferença perceptível.

#### Etapa 4 — Cadastro com e-mail e senha

**Objetivo.** Fluxo 1 completo.
**Banco.** Nenhuma mudança nova (já coberta na Etapa 2).
**Backend.** `POST /auth/register`; hash da senha (`argon2id`);
`EmailToken(VERIFY_EMAIL)` gerado e "enviado" (loga/mocka até a Etapa 25
existir de verdade); rate limit próprio (cadastro em massa é o mesmo tipo
de abuso que login repetido).
**Frontend.** Formulário de cadastro na tela de login (nome, e-mail, senha,
confirmar senha), validação client-side espelhando o schema Zod
(convenção já usada no projeto inteiro).
**Riscos.** Ver R1 e R4 (política de senha).
**Testes.** E-mail duplicado rejeita; senha fraca rejeita; sessão emitida
bate com o mesmo formato do login Google (`AuthUser`/`AuthSession`
inalterados).
**Aceite.** Cadastro cria `User` com `passwordHash`, sem `AuthIdentity`,
loga igual ao fluxo Google.

#### Etapa 5 — Login com e-mail e senha

**Objetivo.** Fluxo 2 completo.
**Banco.** Nenhuma.
**Backend.** `POST /auth/login`; comparação de senha sempre passa pelo hash
(nunca comparação direta); mensagem genérica em qualquer motivo de falha
(R3); contador de tentativas falhas por conta (R2); grava
`passwordClaimedAt` no primeiro sucesso, se ainda nulo (base do
refinamento de R1, usado na Etapa 6).
**Frontend.** Formulário de login (e-mail, senha) ao lado do botão
"Continuar com Google" já existente — os dois convivem na mesma tela.
**Riscos.** R2, R3.
**Testes.** Senha certa loga; senha errada, e-mail inexistente e conta
só-Google devolvem a MESMA mensagem; N tentativas seguidas bloqueiam
temporariamente.
**Aceite.** Login por senha entrega a mesma sessão (cookie + access token)
que o login Google.

#### Etapa 6 — Google para usuário novo ou já vinculado

**Objetivo.** Fluxos 3 e 4 — `loginWithGoogle` reescrito sobre
`AuthIdentity`.
**Banco.** Nenhuma (a partir daqui `AuthIdentity` já é a fonte da
verdade, migrada na Etapa 3).
**Backend.** Reescreve a árvore de decisão do Fluxo 3/4 (ver "Fluxos"
acima) dentro de `authService.loginWithGoogle`; ao linkar numa conta com
`emailVerifiedAt` preenchido mas `passwordClaimedAt` nulo, invalida
`passwordHash` (seta `null`) e loga o evento; `updateGoogleTokens`
continua exatamente igual (credencial de integração, não muda).
**Frontend.** Nenhuma mudança visível — o botão "Continuar com Google" já
existe e continua chamando a mesma rota.
**Riscos.** R1 (auto-link por e-mail, com o refinamento da senha nunca
comprovada) — é o coração desta etapa.
**Testes.** Google novo → `User` novo; Google já vinculado → mesma conta;
Google com e-mail de conta senha verificada E já usada pra logar
(`passwordClaimedAt` preenchido) → linka, senha preservada (é o exemplo do
pedido); verificada mas nunca usada pra logar → linka E invalida a senha;
não verificada → não linka, e-mail tratado como já cadastrado.
**Aceite.** Nenhum usuário Google existente percebe diferença; o
cenário-exemplo do pedido (senha primeiro, Google depois, mesmo e-mail)
resulta em `User` único.

#### Etapa 7 — Configurações → vincular/desvincular Google

**Objetivo.** Fluxos 5, 6 e 7.
**Banco.** Nenhuma.
**Backend.** `POST/DELETE /auth/me/link/google`, com as travas de e-mail
diferente (Fluxo 6, 409) e conta Google já vinculada em outro lugar
(Fluxo 7, 409 pelo `@@unique`) e de "não remover o último método" (ver
"Métodos de login").
**Frontend.** Ainda sem tela própria — endpoint pronto, consumido pela
Etapa 8.
**Riscos.** Confusão de UX se o erro do Fluxo 6 não for claro sobre QUAL
e-mail bateu e qual não.
**Testes.** Vincular com e-mail certo funciona; e-mail diferente bloqueia
com mensagem clara; Google já vinculado a outro `User` bloqueia; conta
só-Google não consegue desvincular sem senha configurada antes.
**Aceite.** Os três fluxos de bloqueio (6, 7, "último método") nunca
deixam uma conta inacessível nem vinculam silenciosamente.

#### Etapa 8 — Tela de métodos de login

**Objetivo.** Superfície visual pros endpoints da Etapa 7.
**Banco.** Nenhuma.
**Backend.** `GET /auth/me/login-methods`; `POST/PATCH /auth/me/password`.
**Frontend.** Primeira tela de Configurações do app (`Configurações →
Conta → Métodos de login`) — mostra e-mail/senha e Google com estado
"Configurado"/"Vinculado" e as ações de cada um, conforme o mockup do
pedido. Ponto de encontro natural com o toggle de "Notificações por
e-mail" cogitado na Etapa 25.
**Riscos.** Baixo — é UI sobre endpoints já testados na Etapa 7.
**Testes.** Estado da tela reflete exatamente `GET
/auth/me/login-methods`; ação de desvincular/adicionar senha atualiza a
tela sem recarregar.
**Aceite.** Dá pra sair de "só Google" para "Google + senha" (ou
vice-versa) inteiramente pela interface, sem nunca ficar sem nenhum
método.

#### Etapa 9 — Recuperação de senha

**Objetivo.** "Esqueci minha senha" — entra no plano (Decisões, item 5),
condicionada à Etapa 25 pra rodar de verdade (R6).
**Banco.** Reaproveita `EmailToken(RESET_PASSWORD)`, já modelado na Etapa
2.
**Backend.** `POST /auth/forgot-password` (sempre resposta genérica,
R3); `POST /auth/reset-password` (token + nova senha, token de uso único
com expiração curta — mesmo padrão de `ClassInvite`/`RefreshToken`).
**Frontend.** Tela "Esqueci minha senha" + "Redefinir senha".
**Riscos.** R3, R6 — sem envio de e-mail de verdade (Etapa 25), fica
sem como testar o fluxo ponta a ponta em produção.
**Testes.** Token expirado/usado rejeita; resposta idêntica pra e-mail
existente e inexistente.
**Aceite.** Só pode avançar de verdade quando a Etapa 25 (ou um envio
mínimo dedicado) estiver pronta — até lá, fica code-complete mas sem
ligar em produção.

#### Etapa 10 — Segurança e testes

**Objetivo.** Fechar o checklist de segurança do pedido, com tudo que não
coube dentro de uma etapa específica.
**Banco.** Índices de suporte se o contador de tentativas falhas (R2)
precisar (ex. `@@index([email, updatedAt])` se for tabela própria em vez
de coluna no `User`).
**Backend.** Revisão cruzada de R1–R7; rate limit dedicado em
`/auth/register` e `/auth/login` (hoje só Google tem `authRateLimiter`).
**Frontend.** Nenhuma.
**Riscos.** É a etapa que EXISTE pra pegar o que ficou barato demais nas
anteriores — tratar como checklist, não como formalidade.
**Testes.** Roteiro E2E real (mesmo padrão usado no resto do projeto:
usuários reais contra banco e servidor rodando) cobrindo os 7 fluxos numa
sequência só, incluindo o cenário do pedido (senha → Google, mesmo
e-mail, um `User` só).
**Aceite.** Todos os pontos de "Aceite" das Etapas 4–9 revalidados juntos,
numa passada só.

## Dashboard

`GET /dashboard/summary` devolve **tudo** que a primeira tela precisa numa resposta só. Seis chamadas separadas significariam seis idas ao servidor antes de qualquer coisa aparecer; no servidor, as consultas independentes rodam em paralelo com `Promise.all`.

### Cálculo das médias

| Nível | Método | Motivo |
| --- | --- | --- |
| Por disciplina | Média **ponderada** pelos pesos das avaliações | Uma P1 peso 2 vale o dobro de um trabalho peso 1 |
| Geral | Média **simples** das médias por disciplina | Sem isso, uma matéria com dez listas dominaria uma com duas provas |

As notas são normalizadas para a escala 0–10 antes da ponderação (uma prova de 100 pontos precisa ser comparável a um trabalho de 10). Disciplinas **sem nota lançada ficam de fora** do cálculo — ausência de avaliação não é média zero.

### Layout

- **Sidebar**: `Sheet` deslizante no mobile, coluna fixa a partir de `lg`. Mesma lista de links, definida uma vez em `lib/navigation.ts`.
- **Breadcrumbs**: derivados do pathname — telas novas entram automaticamente ao serem registradas na navegação.
- **Dark mode**: `next-themes` com `attribute="class"`, alimentando o `@custom-variant dark` do `globals.css`. Um script inline roda antes da pintura, evitando flash branco.
- **Skeletons** reproduzem o formato do conteúdo real, para o layout não saltar quando os dados chegam.

### Busca global e central de notificações (Etapa 19)

Duas peças que o cabeçalho não tinha: uma paleta de comando e um sino. Nada de sidebar, cards, cores, tipografia ou espaçamento foi tocado — a etapa soma dois itens ao cabeçalho e nenhuma cor nova a `globals.css`.

**Busca global (⌘K / Ctrl+K)**

`GET /search?q=` agrega as cinco fontes em paralelo (mesmo `Promise.all` do `dashboard.service`), até 5 resultados por categoria. O acesso a dados é um repositório próprio, e não os cinco de listagem: a paleta precisa de uma projeção única e mínima (título, contexto, cor), não de cinco formatos de item de lista com contagens, paginação e relações que ela nunca exibe — trazer tudo isso para descartar 90% seria trabalho de banco jogado fora a cada tecla.

O resultado **não carrega a URL de destino**. Montar `/disciplinas/:id` é conhecimento da estrutura de rotas desta aplicação (`apps/web/lib/entity-routes.ts`), não do contrato — a mesma busca serviria a um app com outra navegação sem mudar uma linha do backend.

Só disciplina tem tela de detalhe. Para atividades, provas e materiais a URL leva o **termo** (`/atividades?busca=Lista 3`), e a tela abre já filtrada nele: o item escolhido fica na primeira página em vez de perdido na página 4, e o campo de busca preenchido explica por que a lista está curta. Essas telas também forçam o recorte "todas" — uma atividade concluída não apareceria em "pendentes", e a pessoa cairia numa lista vazia logo depois de ver o item no resultado. O calendário fica de fora: ele filtra por intervalo de datas, não por texto.

O termo é destacado com `<mark>` por **fatiamento de string**, nunca `innerHTML` — o termo vem do que a pessoa digitou, e injetá-lo como HTML seria XSS a um passo. A filtragem interna do `cmdk` fica desligada (`shouldFilter={false}`): quem filtra é o servidor, e deixar a biblioteca refiltrar esconderia resultados legítimos que ela não considera parecidos o bastante.

O atalho `⌘K`/`Ctrl+K` é o primeiro *listener* de teclado global do projeto, registrado no `AppShell` pelo mesmo motivo do `useAutoSync`: o shell monta uma vez e sobrevive à navegação.

**Central de notificações**

O modelo `Notification` já existia no schema desde uma etapa anterior, sem repositório, serviço, rota nem tela. A migração `20260810230000_notification_priority` é o que faltava, e é inteiramente **aditiva**: novo enum `NotificationPriority` (🔴 `URGENT`, 🟡 `ATTENTION`, 🔵 `INFO`, 🟢 `DONE`), a coluna com default, o valor `ASSIGNMENT_CREATED` no enum de tipo e um índice por entidade.

Prioridade é separada do tipo de propósito: a mesma atividade vira `ATTENTION` quando vence amanhã e `URGENT` quando vence hoje, sem trocar de tipo.

Geração **sob demanda, não por cron** — o projeto não tem worker nem fila, e um cron seria infraestrutura nova para uma varredura de milissegundos. `GET /notifications` e `GET /notifications/unread-count` rodam a varredura antes de responder; as regras que decidem o que vira notificação são uma função pura com o "agora" injetado (`apps/api/src/utils/notification-rules.ts`), como `spaced-repetition` e `schedule-generator`.

| Fonte | Quando | Prioridade |
| --- | --- | --- |
| Atividade | atrasada (até 30 dias) | 🔴 urgente |
| Atividade | vence hoje | 🔴 urgente |
| Atividade | vence amanhã | 🟡 atenção |
| Atividade | vence em 2–3 dias | 🔵 informativo |
| Prova | hoje ou amanhã | 🔴 urgente |
| Prova | em 2–3 dias | 🟡 atenção |
| Prova | em 4–7 dias | 🔵 informativo |

A varredura **reconcilia**, não acumula: o que deve existir e não existe é criado; o que mudou de estado atualiza a mesma linha (a atividade que ontem "vencia amanhã" hoje "vence hoje" continua sendo uma notificação, não duas); o que perdeu o motivo — atividade concluída, prova que passou — é apagado.

> **A notificação lida também conta na comparação.** A primeira versão só olhava as não lidas, e a varredura recriava, segundos depois, exatamente a notificação que a pessoa acabara de dispensar — o indicador voltava sozinho ao mesmo número. Hoje uma notificação já lida e **idêntica** ao que a varredura produziria bloqueia a recriação; só um estado que de fato evoluiu ("vence amanhã" → "vence hoje") gera um aviso novo. O bug foi encontrado pela verificação contra a API rodando, não pelos testes de unidade.

A reconciliação mexe apenas nas **não lidas** e nos tipos que a varredura administra (`SCANNED_TYPES`): notificação lida é histórico do que a pessoa viu, e a de "nova atividade do Classroom" tem `entityType: ASSIGNMENT` igual às de prazo, mas não é gerada ali.

"Nova atividade adicionada" nasce da sincronização do Classroom — não de um cadastro manual, já que quem cadastra sabe que acabou de fazer isso. Até 5 atividades, uma notificação por atividade, para que o clique leve ao item; acima disso vira um resumo, porque a primeira sincronização importa o semestre inteiro e quarenta linhas no sino são ruído, não informação. Falhar ao notificar não derruba uma sincronização que já deu certo: as atividades já estão salvas.

"Nova prova adicionada" ficou **fora de escopo**: o Classroom não sincroniza provas, então não há fonte automática. Lembretes de prova por proximidade existem (tabela acima) — são outra coisa.

### Endpoints (Etapa 19)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/search` | Busca agregada (disciplinas, atividades, provas, eventos, materiais) |
| GET | `/notifications` | Lista, gerando as pendentes antes de responder |
| GET | `/notifications/unread-count` | Contagem para o indicador do sino |
| PATCH | `/notifications/:id/read` | Marca uma notificação como lida |
| POST | `/notifications/read-all` | Marca todas como lidas |

## Disciplinas

### Excluir arquiva por padrão

`Exam` e `Grade` usam `onDelete: Cascade` — apagar uma disciplina destrói o histórico de notas do semestre. Por isso:

| Ação | Rota | Efeito |
| --- | --- | --- |
| Arquivar (padrão) | `DELETE /subjects/:id` | Sai da listagem; provas, notas e materiais preservados. Reversível. |
| Excluir de vez | `DELETE /subjects/:id?permanent=true` | Remove tudo em cascata. Irreversível. |

Antes de confirmar a exclusão, a interface consulta `GET /subjects/:id/deletion-impact` e mostra **quantos registros de cada tipo** seriam perdidos, oferecendo arquivar como alternativa.

> **Cuidado com booleanos em query string.** `z.coerce.boolean()` aplica `Boolean(valor)` — e como toda string não vazia é verdadeira, `?permanent=false` viraria `true`. Use o helper `booleanQueryParam()` de `@painel/shared` para qualquer flag booleana vinda da URL.

### Média exibida

Disciplina encerrada tem a média consolidada em `finalGrade`; enquanto está em andamento, a média é calculada das notas lançadas (ponderada por peso, normalizada para 0–10). Disciplina sem nenhuma nota mostra `—`, nunca `0,0`.

### Ordenação por média

`average` não é coluna do banco — é derivada de `Grade`. Nesse caso específico o service busca o conjunto filtrado, calcula, ordena e pagina em memória; as demais ordenações vão direto no SQL. Viável porque um usuário tem dezenas de disciplinas, não milhares. Disciplinas sem nota vão sempre para o fim, em qualquer direção.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/subjects` | Lista com `search`, `semesterId`, `status`, `includeArchived`, `sortBy`, `order`, `page`, `perPage` |
| POST | `/subjects` | Cria (aceita `newTeacherName` para cadastrar o professor junto) |
| GET | `/subjects/:id` | Detalhes, incluindo nota necessária para aprovação |
| PATCH | `/subjects/:id` | Atualiza campos enviados |
| DELETE | `/subjects/:id` | Arquiva (ou exclui com `?permanent=true`) |
| POST | `/subjects/:id/restore` | Desarquiva |
| GET | `/subjects/:id/deletion-impact` | Contagem do que seria perdido |
| GET/POST/PATCH/DELETE | `/teachers` | CRUD de professores |

## Atividades

Atividades manuais e importadas do Classroom são a **mesma entidade**, distinguidas por `source`. Aparecem juntas nas mesmas listas, filtros e no dashboard.

### Recortes prontos (`view`)

"Atrasada" é `status ∈ {pendente, em andamento} AND dueDate < agora`. Expor isso como filtros soltos faria cada tela remontar a regra — e chegar a definições diferentes. O servidor traduz:

| `view` | Significado |
| --- | --- |
| `todas` | Sem recorte |
| `pendentes` | Em aberto (pendente ou em andamento) |
| `concluidas` | Concluídas |
| `atrasadas` | Em aberto com prazo vencido |
| `hoje` | Em aberto vencendo hoje |
| `semana` | Em aberto vencendo nos próximos 7 dias |

Atividades **sem prazo** ficam fora dos recortes por data — "vence hoje" não deve listar algo que não vence nunca. Use `includeUndated=true` para incluí-las.

`GET /assignments/counts` devolve a contagem de cada recorte de uma vez, alimentando os contadores das abas.

### Ordenação por prioridade

O enum foi declarado `LOW, MEDIUM, HIGH, URGENT` e o Postgres ordena enums pela **ordem de declaração** — `ORDER BY priority DESC` já traz urgentes primeiro, sem nenhum `CASE`. Reordenar os valores do enum mudaria essa ordenação silenciosamente.

### Concluir

`PATCH /assignments/:id/toggle-complete` alterna o status e carimba `completedAt`. Rota própria porque é a ação mais frequente do sistema — um clique no checkbox não deve exigir que o cliente monte status e data.

No frontend a mudança é **otimista**: a interface responde antes da rede. Se a API falhar, o estado anterior é restaurado e um toast informa o erro.

Uma atividade concluída **nunca** é marcada como atrasada, mesmo com prazo vencido — ela já foi entregue.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/assignments` | Lista com `view`, `search`, `subjectId`, `priority`, `status`, `sortBy`, `order`, paginação |
| GET | `/assignments/counts` | Contagem por recorte (aceita `subjectId`) |
| POST | `/assignments` | Cria (sempre `source: MANUAL`) |
| GET | `/assignments/:id` | Detalhes |
| PATCH | `/assignments/:id` | Atualiza campos enviados |
| PATCH | `/assignments/:id/toggle-complete` | Conclui ou reabre |
| DELETE | `/assignments/:id` | Exclui |

## Provas

Diferente de atividades, **prova exige disciplina**: `Exam.subjectId` é obrigatório no schema. Uma prova sem matéria não existe; uma tarefa pessoal pode.

Prova também não tem status "pendente/concluída" — ou já aconteceu, ou não. Os recortes são temporais:

| `view` | Significado |
| --- | --- |
| `proximas` | `date >= agora` |
| `realizadas` | `date < agora` |
| `todas` | Sem recorte |

Ao trocar para "Realizadas" a interface inverte a ordem padrão para **mais recente primeiro** — em provas futuras interessa a mais próxima; em passadas, a última.

### Nota vinculada

`Grade.examId` é único (1-1). A nota vem no mesmo `select` da listagem, então a lista de provas realizadas **já é o histórico**: mostra o resultado quando lançado, ou "Sem nota". O lançamento em si chega na Etapa 10.

Excluir uma prova **não apaga a nota** — a relação usa `onDelete: SetNull`, e o diálogo de confirmação avisa isso.

### Peso

Alimenta a média ponderada da disciplina. Exibido como badge quando diferente de 1, para o usuário enxergar o impacto de cada avaliação.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/exams` | Lista com `view`, `search`, `subjectId`, `sortBy`, `order`, paginação |
| GET | `/exams/counts` | Contagem por recorte (aceita `subjectId`) |
| POST | `/exams` | Cria |
| GET | `/exams/:id` | Detalhes |
| PATCH | `/exams/:id` | Atualiza campos enviados |
| DELETE | `/exams/:id` | Exclui |

## Calendário

### Uma agregação, não uma cópia

A agenda junta **eventos manuais**, **provas** e **entregas** (pelo prazo) num formato único. Provas e atividades **não são copiadas** para a tabela de eventos — são agregadas em tempo de consulta. Consequência prática: editar uma prova reflete no calendário imediatamente, sem sincronização nem risco de dessincronizar.

A agregação vive em `calendar.service` e é consumida **também pelo dashboard** — antes ele tinha a própria cópia da lógica.

Cada item recebe `key` prefixada (`exam:abc`, `event:abc`) porque ids se repetem entre tabelas diferentes.

### Visões sem grade de horas

O padrão de mercado usa uma linha por hora na visão de semana. **Não foi adotado aqui**: exige altura fixa por faixa, fica ilegível abaixo de 400px, e a maior parte dos itens são entregas com hora simbólica (23h59). As três visões usam listas cronológicas:

| Visão | Layout |
| --- | --- |
| Mês | Grade 7×6; até 3 itens por célula, com "+N itens" |
| Semana | 7 colunas no desktop, empilhadas no celular |
| Dia | Lista cronológica com horário, local e disciplina |

Itens que cobrem vários dias aparecem em **cada** dia do intervalo.

### Fuso horário

O intervalo é calculado no fuso do **navegador** — "semana de 3 a 9 de agosto" depende de onde o usuário está. O cliente envia ISO absoluto; o servidor só filtra. Intervalos acima de 400 dias são recusados.

### O que é editável no calendário

Só eventos próprios. Clicar numa prova ou entrega **não** abre o formulário de evento — elas têm suas próprias telas, com campos que não cabem ali.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/calendar` | Agenda agregada (`from`, `to`, `includeCompleted`) |
| POST | `/calendar/events` | Cria evento próprio |
| GET | `/calendar/events/:id` | Detalhes do evento |
| PATCH | `/calendar/events/:id` | Atualiza (revalida datas contra o valor salvo) |
| DELETE | `/calendar/events/:id` | Exclui |

## Google Classroom

### Política de merge — leia antes de sincronizar

A sincronização é **incremental e não destrutiva**. O que ela faz com um item já importado:

| Campo | Dono | Na sincronização |
| --- | --- | --- |
| Título, descrição, prazo, estado, pontuação, anexos | Classroom | **Sobrescrito** |
| Prioridade, observações | Você | **Preservado** |
| Cor da disciplina | Você | **Preservado** |
| Status concluído | Você | **Nunca revertido** |

A única mudança de status que a sincronização faz é **marcar** como concluída uma atividade entregue no Classroom — jamais desmarcar.

Essas regras aparecem na própria tela de Integrações: o usuário precisa saber o que acontece antes de clicar.

### Deduplicação

Três chaves únicas por usuário garantem idempotência:

| Entidade | Chave |
| --- | --- |
| Disciplina | `@@unique([userId, googleCourseId])` |
| Atividade | `@@unique([userId, googleCourseWorkId])` |
| Professor | `@@unique([userId, googleUserId])` |

Anexos deduplicam por URL — o Classroom não dá id estável para material dentro de uma atividade.

Sincronizar dez vezes seguidas produz o mesmo resultado que sincronizar uma.

### Escopos: somente leitura

Quatro escopos, **todos `readonly`**. O Painel nunca publica nem altera nada no Classroom. Eles são pedidos por autorização incremental — no clique de "Conectar", não no login.

```
classroom.courses.readonly
classroom.coursework.me.readonly
classroom.rosters.readonly
classroom.student-submissions.me.readonly
```

### Sem o pacote `googleapis`

O `googleapis` traz os tipos de **todas** as APIs do Google (dezenas de MB) para consumirmos quatro endpoints. Usamos `fetch` direto na REST API; o `google-auth-library` cuida só de obter e renovar o token.

### Sincronização automática ao abrir o app

Atividades postadas pelo professor **não** aparecem sozinhas em tempo real — não
há webhook nem processo em segundo plano. O que existe: ao abrir o app, o
frontend avisa o servidor, e **o servidor decide** se sincroniza, comparando
`classroomSyncedAt` com um teto de **30 minutos**.

A decisão fica no servidor de propósito. Se o navegador decidisse, uma aba
recarregando em laço esgotaria a cota da conta Google — o teto viraria sugestão.

| Situação | O que acontece |
| --- | --- |
| Última sincronização há menos de 30 min | Responde "pulei", sem tocar no Google |
| Classroom não conectado | Responde "pulei", sem tentar |
| Sincronizou e nada entrou | **Silêncio** — avisar toda vez viraria ruído |
| Sincronizou e entrou algo | Toast com o que foi importado |
| Falhou | Silêncio no toast, registro no log |

Falha aqui **nunca** vira erro na tela: o usuário só queria abrir o dashboard,
não pediu essa sincronização. O botão **Sincronizar Agora** em Integrações
continua sendo o caminho para forçar e ver o relatório completo com os avisos.

O gatilho vive no `AppShell`, que monta uma vez e persiste — circular entre
telas não redispara nada; só recarregar a página.

### Tolerância a falhas

- Uma turma que falhar **não aborta** as demais — o erro vira aviso no relatório
- **Falhar o professor não aborta a turma**: a disciplina e as atividades entram mesmo assim, e o aviso registra o que faltou
- Rascunhos e itens apagados no Classroom são ignorados
- 401/403 pedem reconexão; 429 pede para tentar mais tarde; 5xx é instabilidade do Google e a mensagem diz isso
- Rate limit próprio: 5 sincronizações a cada 5 minutos, para não esgotar a cota da conta Google

O critério: **o que é acessório não derruba o que é essencial.** O professor é
opcional (`Subject.teacherId` é anulável) — perder o nome dele não pode custar a
importação de uma turma inteira com todas as suas atividades.

### "Turma X: importada sem o professor"

Acontece quando a turma pertence a um **Workspace institucional** e a conta que
sincroniza é **externa** a esse domínio — o caso típico de quem entra com Gmail
pessoal em turmas de `@suafaculdade.edu.br`.

O Google recusa resolver o perfil do professor e responde **`500 INTERNAL`**, não
um 403 honesto. Verificado numa conta real, comparando 7 turmas:

| Turma | Domínio do grupo | `teachers` | `teachers/{id}` | `userProfiles/{id}` |
| --- | --- | --- | --- | --- |
| do professor com conta pessoal | `classroom.google.com` | 200 | 200 | 200 |
| as 6 da instituição | `uniformg.edu.br` | 500 | 500 | 500 |

**Os três caminhos falham igualmente**, então não há alternativa via API — e
nenhum escopo adicional muda isso, porque não é falta de permissão e sim política
de visibilidade de diretório. Entrar com a conta institucional (`@dominio.edu.br`)
provavelmente resolve, já que aí a conta é interna ao domínio.

Consequência prática: a turma e as atividades são importadas normalmente, só o
nome do professor não vem. Você pode preenchê-lo à mão em **Disciplinas**.

Sobre o que acontece nas próximas sincronizações — a regra é
`teacherId ?? existingSubject.teacherId`:

- enquanto o Google continuar sem devolver o professor, **o que você digitou é preservado**;
- se o Google voltar a devolvê-lo, **o dado do Classroom prevalece**, pela mesma
  política de merge das demais colunas vindas da integração.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/integrations/status` | Estado das conexões e contadores |
| GET | `/integrations/classroom/connect` | Devolve a URL de autorização incremental |
| POST | `/integrations/classroom/sync` | Sincroniza e devolve o relatório |
| DELETE | `/integrations/classroom` | Desconecta (dados importados permanecem) |

## Google Calendar

Importa compromissos da sua agenda para o calendário do Painel — ao lado de provas e entregas.

### Somente leitura, por escolha

O escopo é apenas `calendar.readonly`. A versão inicial do código pedia também `calendar.events`, que dá **permissão de escrita** na agenda pessoal; foi removido. Pedir permissão que não se usa é má prática e reduz a confiança na tela de consentimento.

Consequência: o Painel **não exporta** provas e entregas para o Google. Se quiser isso depois, é uma decisão consciente de ampliar o escopo.

### `singleEvents=true` — não é detalhe

Sem essa flag, um evento recorrente ("aula toda terça") chega como **uma** entrada com regra de recorrência, e apareceria uma única vez no calendário. Com ela, o Google expande em instâncias individuais, cada uma com id próprio (`abc_20260815T120000Z`) — o que também resolve o dedupe.

### Evento apagado no Google some daqui

Só criar e atualizar deixaria eventos fantasma. A sincronização compara o que existe importado na janela com o que veio na resposta e **remove a diferença**. Cancelar um compromisso no Google tem efeito imediato aqui.

### Escopo da importação

| Aspecto | Decisão |
| --- | --- |
| Calendários | Apenas o **principal** — importar feriados, aniversários e assinaturas encheria a tela |
| Janela | 30 dias atrás até 180 à frente |
| Eventos do Painel (`MANUAL`) | **Nunca** tocados pela sincronização |
| Vínculo com disciplina | Preservado (é do Painel, não do Google) |
| Título, horário, local | Sempre sobrescritos (são do Google) |

### Eventos importados são somente leitura

Recebem ícone próprio no calendário e **não abrem o formulário de edição** — a próxima importação sobrescreveria a alteração. Clicar mostra um aviso indicando editar na agenda do Google.

### Desconectar remove os importados

Diferente do Classroom: sem a integração ativa, os eventos nunca mais seriam atualizados, e cópias congeladas da agenda confundiriam mais do que ajudariam. Eventos criados no Painel permanecem.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/integrations/calendar/connect` | URL de autorização (escopo readonly) |
| POST | `/integrations/calendar/sync` | Importa e devolve o relatório |
| DELETE | `/integrations/calendar` | Desconecta e remove os importados |

## Notas

### Componentes de avaliação configuráveis, não um enum fixo

Antes da Etapa 17, `Grade.type` era um enum fixo (`P1, P2, P3, ASSIGNMENT, SEMINAR, ...`) — o sistema "sabia" que existiam P1/P2/P3, preso ao modelo de uma instituição específica. Agora o sistema só sabe que existem **componentes de avaliação configuráveis**, definidos pelo próprio usuário:

```
Semester
   │
   └── GradeConfiguration (modelo padrão, opcional)
          └── GradeComponent[]  (nome, peso, ordem)

Subject
   │
   └── GradeConfiguration (1-1, sempre independente)
          └── GradeComponent[]  (copiados do modelo do semestre ao criar a disciplina;
                                  editar depois nunca afeta o modelo nem outras disciplinas)

Grade
   ├── gradeComponentId  (o peso usado na média vem do componente, não é mais digitado à mão)
   ├── value / maxValue  (cada lançamento guarda sua própria escala)
   └── examId?           (vínculo opcional com uma prova)

Exam
   └── gradeComponentId?  ("esta prova é referente a qual componente" — e de onde vem o peso dela)
```

`GradeConfiguration.subjectId` e `.semesterId` são FKs independentes (mesmo padrão de `Grade.examId`/`.assignmentId`) — uma configuração pertence a exatamente uma coisa: uma disciplina (o caso normal, usado no cálculo) ou um semestre (um modelo padrão, que só serve para pré-preencher disciplinas novas). Um componente com nota já lançada não pode ser excluído (`Grade.gradeComponentId` usa `onDelete: Restrict`) — a API recusa com uma mensagem clara em vez de deixar o erro estourar como violação de constraint.

### Nota necessária para aprovação

```
necessária = (aprovação × pesoTotal − pontosObtidos) ÷ pesoRestante
```

O peso restante vem dos **componentes configurados que ainda não têm nota** — dado real, nunca uma suposição de peso total fixo. Exemplo com aprovação 6, N1 (peso 3, nota 2,5) e N2 (peso 4, nota 8) lançadas, N3 (peso 3) pendente:

`(6 × 10 − 39,5) ÷ 3 = 6,83`

Sem componentes pendentes, `requiredGrade` é **`null`** — a interface não inventa um número. Quando mais de um componente está pendente, o resultado assume que todos precisam da mesma nota ("precisa de X em N2, N3").

Essa é a **única** implementação do cálculo — antes da Etapa 17, a tela de Notas e o detalhe da disciplina tinham cada uma a sua própria estimativa, que podiam divergir para a mesma disciplina. Hoje ambas chamam `gradeService.getSubjectSummary`.

| Status | Condição |
| --- | --- |
| Aprovado | Média já garante a aprovação mesmo zerando o restante |
| Atenção | Ainda é possível, mas exige nota ≥ 7 no que falta |
| Em andamento | Precisa de menos de 7 no restante |
| Reprovado | Nem com nota máxima alcança a média |
| Sem notas | Nada lançado ainda |

Uma prova de 100 pontos e um trabalho de 10 são comparáveis: tudo é normalizado para 0–10 antes de ponderar. A interface mostra o valor original **e** o equivalente (`80/100 = 8,0`).

### Simulação

Calculadora client-side (`apps/web/lib/grade-math.ts` espelha `apps/api/src/utils/grade-calculator.ts` — mesma álgebra dos dois lados). Carrega as notas reais já lançadas como ponto de partida, mas qualquer campo — inclusive os já lançados — pode ser editado livremente para explorar cenários. **Nada é salvo**: fechar o diálogo descarta tudo. Para uma nota simulada virar real, o caminho é o formulário normal de lançamento.

### Vínculo com provas

Lançar a nota direto no formulário da prova (campo "Nota" + seletor de "Componente de nota") cria ou atualiza a `Grade` vinculada automaticamente. Apagar a nota no formulário da prova remove a `Grade` junto — os dois lados são tratados como uma coisa só. `Grade.examId` continua único: uma prova tem no máximo uma nota.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/grades/overview` | Boletim de todas as disciplinas em andamento (aceita `semesterId`) |
| GET | `/grades/subject/:id` | Boletim de uma disciplina, com projeção |
| GET | `/grades` | Lista de notas (aceita `subjectId`) |
| POST | `/grades` | Lança uma nota |
| PATCH | `/grades/:id` | Atualiza |
| DELETE | `/grades/:id` | Exclui |
| GET | `/subjects/:id/grade-configuration` | Configuração de notas da disciplina |
| PUT | `/subjects/:id/grade-configuration` | Substitui os componentes e a nota de aprovação |
| GET | `/semesters/:id/grade-configuration-template` | Modelo padrão do semestre (`null` se ainda não definido) |
| PUT | `/semesters/:id/grade-configuration-template` | Substitui o modelo padrão |

### Modelo de semestre (Etapa 18)

Duas lacunas que só apareceram com uso real, mais um ajuste no peso das provas.

**Semestre novo já nasce com o modelo.** `semesterService.create` copia o **modelo pessoal** (o mesmo criado no primeiro login: N1/3, N2/4, N3/3) como template inicial, na mesma transação que cria o semestre — mesmo padrão de `subjectRepository.createWithGradeConfiguration`. Antes, cada período começava vazio e os componentes eram reconfigurados na mão, com o modelo pessoal parado ali do lado. Um modelo pessoal **sem componentes** não vira template: `findByTemplateSemester` passaria a encontrar uma configuração vazia e disciplinas novas nasceriam sem componente nenhum, em vez de herdarem o modelo pessoal.

**Propagar o modelo virou um passo explícito.** A garantia da Etapa 17 continua de pé — `GradeConfiguration` é copiada, nunca compartilhada, e salvar o modelo não altera disciplina nenhuma. O que mudou é que agora existe um caminho para propagar, com confirmação:

1. `GET /semesters/:id/grade-configuration-template/propagation-preview` compara o modelo com a configuração de cada disciplina do período e devolve a diferença: componente ausente na disciplina, peso divergente, `passingGrade` divergente. Disciplinas já alinhadas ficam fora da resposta.
2. Salvar o modelo abre a confirmação com as disciplinas afetadas marcadas por padrão, destacando quando o componente já tem nota lançada — ali mudar o peso recalcula uma média que a pessoa já viu na tela.
3. `POST .../propagate` aplica só nas disciplinas enviadas.

A fusão é sempre **aditiva** (`apps/api/src/utils/grade-template-merge.ts`, função pura): componente do modelo ausente na disciplina é criado; presente nos dois tem peso e ordem sincronizados; **componente que só a disciplina tem nunca é removido**. Remoção continua manual, na configuração da própria disciplina, onde existe o bloqueio de "já tem nota lançada" — um modelo jamais apaga nota de ninguém. Componentes são casados por **nome** (ignorando caixa e espaços), já que cada cópia tem ids próprios.

A prévia e a gravação usam a mesma função: se fossem duas implementações, a confirmação acabaria mentindo sobre o que seria gravado. Um teste garante que, depois de fundir, não sobra diferença nenhuma.

Os modelos saíram do formulário de disciplina — onde o atalho "Configurar modelo de notas de [semestre]" passava a impressão de estar editando aquela disciplina — para um menu **Modelos de notas** na tela de Disciplinas, com o modelo padrão e um item por semestre. O link contextual continua no formulário, como conveniência.

### O peso da prova vem do componente

`Exam.weight` deixou de existir. O peso de uma prova é o do **componente** que ela representa, derivado na leitura — editar o peso do N1 vale imediatamente para todas as provas dele, sem cópias desatualizadas por aí. Prova sem componente tem `weight: null` (não entra na média, e exibir "peso 1" sugeriria o contrário). A coluna já era decorativa desde a Etapa 17, quando o peso migrou para `GradeComponent`; a migração `20260810200000_exam_weight_from_component` a remove sem backfill — não há como traduzir peso de prova em peso de componente, já que várias provas podem apontar para o mesmo.

### Nota parcial conta no cálculo

`isFinal: false` ("ainda não é a nota final") significa que **mais pontos podem somar** naquele componente — não que os pontos já lançados não valham. O cálculo descartava o valor inteiro, o que tornava a projeção inútil justamente para quem usava o recurso: com N1 5 (peso 3) e N2 5 (peso 4, em aberto), o sistema pedia 6,4 "na N2 e N3", ignorando os 20 pontos já garantidos da N2. O correto é 8,33 na N3 — `(6 × 10 − 35) ÷ 3`.

Agora `pendingComponents` são só os componentes **sem nenhum lançamento**. Como um componente pode receber vários lançamentos, `toGradeLikes` **agrupa por componente** antes de ponderar: os valores somam (normalizados para 0–10) e o peso entra uma vez só. Sem o agrupamento, dois lançamentos no N2 de peso 4 contariam peso 8 e o componente valeria o dobro do configurado.

### Data digitada é a data salva

O JavaScript lê `"2026-10-05"` como meia-noite **UTC** e `"2026-10-05T00:00"` como meia-noite **local**. Como o formulário de prova usa um seletor de data (sem hora), uma prova cadastrada para 05/10 era gravada às 00:00Z — 21h do dia 04 em Brasília — e aparecia um dia antes no calendário. `parseLocalDate` (em `packages/shared/src/common.ts`) acrescenta a hora explícita quando a string é só data, e é usado por todos os schemas com data. Strings que já trazem hora passam direto.

Registros gravados **antes** dessa correção continuam um dia adiantados até serem salvos de novo — o dado antigo não é reescrito automaticamente.

### Endpoints (Etapa 18)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/semesters/:id/grade-configuration-template/propagation-preview` | O que mudaria em cada disciplina do período |
| POST | `/semesters/:id/grade-configuration-template/propagate` | Aplica o modelo nas disciplinas escolhidas |

## Histórico

O boletim (Etapa 10) responde "como estou indo agora". O histórico responde "o que já ficou para trás" — e essas duas perguntas exigem números diferentes.

### Encerrar um semestre congela as médias

Enquanto o semestre está aberto, a média de uma disciplina é **derivada**: recalculada a cada nota lançada. Isso é o certo para o período corrente e errado para o histórico — corrigir hoje o peso de uma prova de dois anos atrás não pode mudar um histórico já consolidado.

`POST /semesters/:id/close` resolve isso materializando o resultado:

1. calcula a média ponderada de cada disciplina do período;
2. grava em `Subject.finalGrade` e define `status` como `APPROVED` ou `FAILED` comparando com o `passingGrade` da disciplina;
3. marca o semestre como `FINISHED` e tira o `isCurrent`.

A partir daí a tela lê `finalGrade` (rotulado **final**) em vez de recalcular. Editar uma nota antiga passa a não afetar o histórico.

Antes de confirmar, `GET /semesters/:id/close-preview` devolve exatamente o que será gravado em cada disciplina — inclusive quantas ficarão sem média por não terem notas lançadas. A operação é reversível: `POST /semesters/:id/reopen` limpa `finalGrade`, devolve o status para `IN_PROGRESS` e as médias voltam a ser calculadas.

### CR ponderado por créditos

O dashboard mostra a média **simples** entre as disciplinas em andamento. O CR do histórico é diferente em dois pontos, porque imita o que a faculdade calcula:

- pondera por **créditos** — uma disciplina de 6 créditos pesa três vezes mais que uma de 2;
- conta apenas as disciplinas **aprovadas e já consolidadas**.

```
CR = Σ(finalGrade × créditos) ÷ Σ(créditos)   — apenas APPROVED
```

Com os dados do seed: `(8,7 × 4 + 7,4 × 4) ÷ 8 = 8,1`. A disciplina reprovada (5,2) entra na contagem de créditos cursados, mas não no CR.

### Excluir um semestre não exclui disciplinas

`semesterId` é opcional em `Subject` e usa `onDelete: SetNull`. Apagar um período deixa as disciplinas sem vínculo em vez de destruir o histórico de notas — elas aparecem na seção "Sem período atribuído", prontas para serem reatribuídas.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/semesters` | Lista os períodos com contagens |
| GET | `/semesters/history` | Histórico agrupado + CR e créditos |
| POST | `/semesters` | Cria (ano + período são únicos por usuário) |
| PATCH | `/semesters/:id` | Atualiza |
| DELETE | `/semesters/:id` | Exclui, preservando as disciplinas |
| GET | `/semesters/:id/close-preview` | Prévia da consolidação |
| POST | `/semesters/:id/close` | Encerra e congela as médias |
| POST | `/semesters/:id/reopen` | Reabre e descongela |

## Materiais

Um material é um **arquivo enviado** ou um **link externo**. As duas formas vivem na mesma entidade porque cumprem o mesmo papel para quem estuda; o que muda é o `source`.

### Storage atrás de uma interface

Nenhuma camada de negócio sabe onde os bytes moram. `StorageProvider` (`apps/api/src/storage/types.ts`) define `save`/`createReadStream`/`remove`/`removeMany`. Duas implementações existem hoje, escolhidas por `STORAGE_DRIVER`:

- `LocalStorageProvider` — grava em `UPLOAD_DIR`. Só funciona com disco persistente (dev local, Docker com volume).
- `R2StorageProvider` — fala com o Cloudflare R2 via API compatível com S3. Obrigatório em produção serverless (Vercel), onde não há disco entre invocações.

Service, controller e rota ficam intactos nos dois casos — só conhecem `storage`, nunca o provider concreto.

A chave é sempre gerada pela aplicação, nunca pelo cliente:

```
{userId}/{ano}/{mês}/{uuid}{extensão}
```

O prefixo por usuário prepara políticas de acesso por prefixo num bucket, e o nome aleatório torna *path traversal* impossível por construção — o nome original vira apenas rótulo de exibição.

### O que é validado, e por quê

| Camada | Regra |
| --- | --- |
| Extensão | **Allowlist** — nunca blocklist, que sempre esquece um formato executável novo |
| Tamanho | `MAX_UPLOAD_SIZE_MB` (25 MB), aplicado pelo multer antes de ler o corpo inteiro |
| Conteúdo | *Magic bytes* conferidos contra a extensão declarada |
| MIME | Derivado da extensão no servidor — o MIME enviado pelo cliente é ignorado |

O `Content-Type` do multipart é escolhido por quem envia: um executável renomeado para `.pdf` chega anunciado como `application/pdf`. Por isso os primeiros bytes são conferidos. Formatos de texto (`.txt`, `.md`, `.csv`, `.svg`) não têm assinatura binária; para eles a checagem é o conteúdo ser decodificável como UTF-8 sem bytes nulos, o que já barra binário disfarçado.

O multer usa `memoryStorage`. Com `diskStorage` o arquivo seria gravado **antes** de qualquer validação, e cada tentativa inválida deixaria lixo no disco.

### Download é rota autenticada, não pasta estática

Servir `UPLOAD_DIR` com `express.static` daria a qualquer um com o caminho acesso ao arquivo de qualquer usuário. O download passa por `GET /attachments/:id/download` → `authenticate` → checagem de dono → stream, e sempre com:

- `Content-Disposition: attachment` — nunca inline;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`.

Como `<img src>` e `<iframe src>` não enviam o header `Authorization`, o frontend busca os bytes pelo cliente HTTP e monta um *object URL* local. A pré-visualização de PDF roda em `<iframe sandbox="">`.

SVG é aceito no upload mas **nunca** é pré-visualizado inline: é XML e pode carregar script, o que seria XSS armazenado no nosso domínio.

### Exclusão em cascata não deixa arquivos órfãos

O banco apaga as linhas de `Attachment` por cascata quando a disciplina, atividade ou prova some — mas não conhece o disco. Os services desses donos chamam `purgeStorageForOwner` **antes** de excluir. Para disciplina o alcance é transitivo: leva também os materiais das provas e atividades dela.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/attachments` | Lista paginada (filtros: `search`, `subjectId`, `type`, `source`) |
| GET | `/attachments/summary` | Contagens e espaço ocupado |
| POST | `/attachments/upload` | Envia um arquivo (multipart, campo `file`) |
| POST | `/attachments/link` | Cadastra um link |
| GET | `/attachments/:id` | Metadados |
| GET | `/attachments/:id/download` | Baixa o arquivo |
| PATCH | `/attachments/:id` | Renomeia e/ou revincula |
| DELETE | `/attachments/:id` | Exclui registro e arquivo |

## Flashcards

Um **baralho** (`Deck`) agrupa cartões por assunto e pode pertencer a uma disciplina. Cada **cartão** carrega o próprio estado de repetição espaçada.

### Por que repetição espaçada, e não uma lista

Mostrar todos os cartões do baralho a cada estudo faz o aluno gastar tempo no que já sabe — exatamente o que flashcards deveriam evitar. O agendamento usa **SM-2** (Piotr Wozniak, 1987; a base do Anki), guardando três valores por cartão:

| Campo | Papel |
| --- | --- |
| `easeFactor` | Quão "fácil" o cartão é. Começa em 2,5 e nunca cai abaixo de **1,3** |
| `intervalDays` | Dias até a próxima revisão |
| `repetitions` | Acertos consecutivos. Zera a cada erro |

Acertando sempre, os intervalos crescem: **1 → 6 → 15 → 38 → 95 → 238 dias**. Errar zera a sequência, devolve o intervalo para 1 dia e reduz permanentemente o `easeFactor` — o cartão volta a aparecer com mais frequência mesmo depois de o aluno recomeçar a acertá-lo.

O piso de 1,3 no `easeFactor` existe para um caso concreto: sem ele, um cartão errado muitas vezes teria o fator empurrado para perto de zero e ficaria preso repetindo todo dia para sempre.

O cálculo vive em `utils/spaced-repetition.ts` como **função pura**, com o "agora" injetado. Isso permite testar o agendamento sem banco e sem servidor, e impede a regra de vazar para o repositório.

### A avaliação que o aluno vê

Quatro botões, com a consequência de cada um à vista antes do clique:

| Botão | `quality` | Efeito |
| --- | --- | --- |
| Errei | 0 | Volta amanhã, sequência zerada, registra *lapse* |
| Difícil | 3 | Avança, mas o cartão fica mais "caro" |
| Bom | 4 | Avança mantendo o ritmo |
| Fácil | 5 | Avança e fica mais "barato" |

Sem o intervalo previsto no botão, "Bom" e "Fácil" viram escolha arbitrária. A previsão vem do servidor junto com o cartão — duplicar o SM-2 no cliente só para escrever "6 dias" criaria duas implementações que divergiriam na primeira mudança.

Atalhos de teclado: **espaço** revela a resposta, **1–4** avaliam. Estudar com o mouse trava o ritmo.

### O servidor não guarda sessão

Cada avaliação é um `POST` independente. Fechar a aba no meio não perde nada nem deixa sessão pendurada — o progresso já está nos cartões. Em compensação, a tela **congela a fila** ao iniciar: reagir a mudanças da query no meio do estudo trocaria o cartão sob os pés do usuário.

### Log de revisões

`FlashcardReview` é append-only e grava cada avaliação junto com o novo estado do cartão, **na mesma transação**. O estado no cartão responde "o que revisar agora"; ele não responde "quanto estudei nesta semana" — e o histórico só existe se for gravado no momento em que acontece. É dele que saem a sequência de dias e a taxa de retenção.

### Ordem da fila

Vencidos há mais tempo primeiro; novos por último. Mostrar cartões inéditos antes dos atrasados infla a carga futura: o aluno acumula dívida enquanto conhece material novo.

Um cartão é considerado **dominado** a partir de 21 dias de intervalo — antes disso o SM-2 ainda está em aprendizado, e chamá-lo de dominado daria uma sensação falsa de progresso.

### Importação em lote

Digitar cartão a cartão é o maior atrito de um app de flashcards. O diálogo de importação aceita uma linha por cartão, com frente e verso separados por **tabulação**, `;` ou ` - `. A tabulação vem primeiro porque é o que sai ao copiar de uma planilha. Linhas sem separador são apontadas em vez de silenciosamente ignoradas.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/decks` | Lista baralhos com contagens |
| POST | `/decks` | Cria |
| GET | `/decks/:id` | Detalhe |
| PATCH | `/decks/:id` | Atualiza |
| POST | `/decks/:id/archive` | Arquiva (tira da fila, preserva os cartões) |
| POST | `/decks/:id/unarchive` | Reativa |
| DELETE | `/decks/:id` | Exclui (cartões em cascata) |
| GET | `/decks/:id/cards` | Cartões do baralho (`view`, `search`) |
| POST | `/flashcards` | Cria um cartão |
| POST | `/flashcards/bulk` | Cria vários |
| PATCH | `/flashcards/:id` | Edita o texto (não afeta o agendamento) |
| DELETE | `/flashcards/:id` | Exclui |
| GET | `/flashcards/queue` | Fila de estudo |
| POST | `/flashcards/:id/review` | Registra a avaliação e reagenda |
| GET | `/flashcards/stats` | Pendentes, sequência e retenção |

## Cronograma

O cronograma não é um segundo calendário para preencher à mão — isso seria só trabalho a mais. Ele responde **"o que eu estudo hoje?"** a partir do que já está cadastrado: provas próximas e atividades pendentes, encaixadas nas janelas em que o aluno declarou estar livre.

### Disponibilidade

`StudyAvailability` guarda janelas semanais recorrentes como `(dayOfWeek, startMinute, endMinute)`. Duas decisões aqui:

- **Tabela, não JSON no usuário.** Um dia costuma ter mais de uma janela ("livre 9h–11h e 14h–18h"), e o gerador consulta por dia da semana. Em JSON toda geração leria o objeto inteiro e filtraria em memória.
- **Minutos desde a meia-noite, não `DateTime`.** Gravar "14:00" num `DateTime` transforma um horário recorrente num instante, e a partir daí é briga com fuso horário para sempre.

A grade inteira é salva de uma vez (`PUT`), não janela a janela: o usuário edita várias linhas e clica em salvar uma vez, e a tela nunca fica em estado parcial se uma chamada falhar no meio. Janelas sobrepostas no mesmo dia são recusadas — elas fariam o gerador contar o mesmo tempo duas vezes.

### O gerador

Função pura em `utils/schedule-generator.ts`: recebe janelas, alvos e a data de referência; devolve os blocos. Sem banco, sem `new Date()` implícito, sem efeito colateral.

O problema é um escalonamento com prazos: distribuir N tarefas com datas-limite em M janelas de tempo. A solução é **gulosa** — ordena por urgência e preenche a primeira janela que serve. Um ótimo global exigiria programação inteira para ganhar quase nada numa semana de estudo.

**Priorização.** A proximidade do prazo domina; o resto desempata:

```
score = bônus(tipo) + bônus(prioridade) + min(peso, 10) + 200 / (diasRestantes + 1)
```

A curva hiperbólica é proposital: 1 dia vale ~100 pontos, 7 dias ~25, 30 dias ~6. É o que faz uma **entrega de amanhã ganhar de uma prova daqui a duas semanas** — perder o prazo custa a nota inteira, enquanto a prova ainda terá outras chances de estudo.

**Garantias do encaixe:**

| Regra | Motivo |
| --- | --- |
| Nada antes de agora | Não se agenda para o passado |
| Nada depois do prazo | Estudar para uma prova no dia seguinte a ela não ajuda |
| Desvia de compromissos existentes | Marcar estudo em cima da própria prova seria pior que não marcar |
| Teto de blocos por dia | Um sábado livre não vira maratona de dez blocos |
| Intervalo entre blocos | Blocos coladas não sobrevivem à atenção |

O que não coube volta em `unscheduled` **com o motivo** — "não há tempo livre suficiente antes do prazo", "coube 3 de 4 blocos". Sem isso o aluno olharia uma agenda incompleta sem saber o que ajustar.

### Regerar nunca apaga o que é seu

`StudySession.autoGenerated` separa o que a máquina propôs do que o aluno decidiu. A regeneração remove **apenas** blocos que sejam simultaneamente automáticos, ainda `PLANNED` e no futuro. Fora disso:

- blocos criados à mão permanecem;
- blocos já concluídos ou pulados permanecem — são histórico de estudo real;
- **editar um bloco gerado o torna manual**, senão o ajuste sumiria na próxima geração sem aviso.

E os blocos preservados viram obstáculo que o gerador desvia, não espaço que ele ignora.

### Planejado ≠ executado

`plannedMinutes` vem das datas; `actualMinutes` é gravado ao concluir. Sem essa separação, "estudei 6 horas esta semana" seria uma intenção, não um fato. Concluir sem informar o tempo assume a duração planejada — a melhor estimativa disponível.

A **adesão** é `concluídos / (concluídos + pulados)`: blocos ainda planejados não contam, porque o dia deles não chegou.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/study-plan/availability` | Janelas semanais |
| PUT | `/study-plan/availability` | Substitui a grade inteira |
| POST | `/study-plan/generate` | Gera o cronograma |
| GET | `/study-plan/summary` | Planejado, estudado e adesão |
| GET | `/study-sessions` | Blocos no intervalo (`from`, `to`) |
| POST | `/study-sessions` | Cria bloco manual |
| PATCH | `/study-sessions/:id` | Edita (e torna manual) |
| POST | `/study-sessions/:id/complete` | Conclui, registrando o tempo real |
| POST | `/study-sessions/:id/skip` | Marca como pulado |
| POST | `/study-sessions/:id/reopen` | Volta para planejado |
| DELETE | `/study-sessions/:id` | Exclui |

## Estatísticas

Cinco recortes numa tela, alimentados por **um** endpoint agregado — cinco gráficos com endpoints próprios seriam cinco viagens de rede na primeira carga. As consultas rodam em paralelo no servidor.

### A forma vem antes da cor

Cada gráfico responde a uma pergunta, e a pergunta escolhe a forma:

| Pergunta | Forma | Por quê essa |
| --- | --- | --- |
| "Estou estudando?" | barra por dia | volume por dia, não medida contínua |
| "Onde estou mal?" | barra horizontal, **uma cor** | nomes longos pedem horizontal; a barra já codifica o valor |
| "Estou melhorando?" | linha, 2 séries | tendência ao longo dos semestres |
| "Como está minha entrega?" | barra empilhada | parte-do-todo; pizza com 4 fatias é ilegível |
| Números de destaque | *stat tiles* | um valor único não é um gráfico de uma barra |

O gráfico de média por disciplina usa **uma cor só**, apesar de cada disciplina ter a sua no resto do app: aqui o comprimento da barra já mostra o valor, e pintar cada uma de um tom gastaria o único canal livre repetindo informação que o gráfico já dá. A identidade fica no rótulo do eixo.

### A paleta foi validada por script, não escolhida no olho

Os tokens `--chart-1..3` passaram por um validador de paletas nos dois temas: faixa de luminosidade, piso de croma, separação sob daltonismo e contraste com a superfície.

```
claro  #2a78d6  #eb6834  #1baf7a   pior par (deuteranopia) ΔE 9.2
escuro #3987e5  #d95926  #199e70   pior par (deuteranopia) ΔE 9.4
```

O alvo é ΔE ≥ 8. **Trocar qualquer um desses hex exige rodar o validador de novo.** São três slots de propósito: um quarto colocaria amarelo e laranja na mesma tela, par que reprova nos pisos — e nenhum gráfico aqui precisa de mais de duas séries categóricas.

Os valores do tema escuro são passos próprios para a superfície escura, **não** uma inversão automática dos claros.

### Regras que a tela respeita

- **Nunca dois eixos Y.** Minutos estudados e cartões revisados têm escalas incomparáveis: dois gráficos. Um segundo eixo inventaria uma correlação a partir do alinhamento arbitrário das escalas.
- **Um filtro, acima de tudo.** Filtros dentro de cada card fariam o usuário comparar recortes diferentes sem perceber.
- **Toda série tem tabela equivalente**, alcançável por um botão. Um gráfico que só pode ser lido por cor e posição exclui quem usa leitor de tela e quem precisa do número exato.
- **Cores de status são reservadas.** A barra de situação das atividades usa os tokens semânticos (bom/atenção/crítico), nunca a paleta de séries — e cada segmento vem com ícone e rótulo, porque cor sozinha não pode carregar o significado.
- **Marcas finas, grade sólida e discreta**, rótulos diretos seletivos (nunca um número em cada ponto).
- **Sem salto de layout ao trocar o período**: o conteúdo anterior fica com opacidade reduzida em vez de virar esqueleto.

### Os dias vazios são a informação

As séries diárias trazem **todos** os dias do intervalo, inclusive os zerados. Omitir os dias sem dado faria a linha ligar 10 de janeiro direto a 25 de janeiro, desenhando uma inclinação suave onde houve duas semanas sem estudar.

### Agregação em memória, e por quê

O recorte é sempre de um único usuário num intervalo limitado (365 dias no máximo) — algumas centenas de linhas. Nesse volume, buscar e agrupar em JS custa menos que perder a tipagem do Prisma numa query bruta. **Se isso virar consulta multi-usuário ou o intervalo crescer para anos, a conta inverte** e `date_trunc` no SQL passa a valer o custo.

### Endpoint

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/statistics` | Todos os recortes (`period`: 30, 90, 180 ou 365) |

## Turmas (planejado)

> **Status: plano aprovado, implementação não iniciada.** Nada abaixo existe no
> código ainda. Nenhuma migração foi criada.

Uma turma é um **grupo de pessoas de um período**, não de uma disciplina:
"7º Período — 2026.2" reúne Redes, Banco de Dados, IA, Compiladores e TCC.
Quem cria é o representante da turma, e a partir daí publica atividades,
provas, eventos, avisos e materiais para todo mundo de uma vez.

### O conflito arquitetural que decide o desenho

O sistema hoje é, sem exceção, **um banco de dados por usuário** — 366
ocorrências de `userId` nos 20 repositórios. Toda entidade de domínio tem
`userId` obrigatório com `onDelete: Cascade`, e toda consulta filtra por ele.
Não existe nenhum dado compartilhado em lugar nenhum.

Três consequências que invalidam a modelagem ingênua:

- **Semestre é por usuário** (`@@unique([userId, year, term])`). "2026.2" do
  Marden e do João são linhas diferentes. Não há semestre global para a turma
  referenciar.
- **Disciplina é por usuário.** "Redes" do Marden tem `GradeConfiguration`,
  componentes e cor próprios; a do João, outros.
- **Nota depende da disciplina do usuário.** `Grade.gradeComponentId` aponta
  para o componente *daquele* usuário.

> Portanto **"prova compartilhada" não pode ser uma linha de `Exam` visível
> para cinco pessoas**: `Exam.subjectId` aponta para a disciplina de *uma*
> pessoa, e a nota não teria onde ser pendurada.

### Decisão: publicação + cópia (*fan-out*)

A turma guarda o registro canônico; publicar **cria uma cópia pessoal** para
cada membro, apontando para a disciplina *dele*, com referência de volta.

| | cópia (escolhida) | linha compartilhada |
| --- | --- | --- |
| Consultas existentes a reescrever | **0** | ~366 |
| Nota individual privada | por construção | exige tabela de overlay |
| Dashboard, Calendário, Estatísticas, Busca, Notificações | **sem alteração** | todos reescritos |
| Edição do dono propaga | precisa de propagação | instantânea |
| Risco de vazamento entre contas | baixo (cada um lê o seu) | alto (todo filtro vira "meu OU da turma") |

O argumento decisivo é que **o projeto já faz isso duas vezes**, e são os dois
módulos que melhor funcionaram: a sincronização do Classroom copia cada
`courseWork` para um `Assignment` do usuário (com `@@unique([userId,
googleCourseWorkId])` garantindo idempotência), e a Etapa 18 copia o modelo de
notas do semestre para cada disciplina. A Turma é o mesmo problema — uma
origem publica, muitas cópias pessoais consomem — e o custo conhecido do
padrão (divergência quando o membro edita a cópia) já tem resposta pronta na
Etapa 18.

**Restrição de infraestrutura:** o deploy é Vercel + Neon, sem worker nem fila.
O *fan-out* é **síncrono e limitado** — 40 membros são 40 inserts numa
transação. Teto explícito de **100 membros por turma**, para que isso nunca
vire problema por descuido.

### Nomenclatura

**`Class`**, não `Classroom`: `Classroom` já significa *Google Classroom* em
todo o código (`classroom-sync.service`, `hasClassroomAccess`,
`classroomLink`). Reusar o termo criaria ambiguidade permanente. Na interface,
"Turma".

### Modelagem

```
User ──< ClassMember >── Class ──< ClassSubject
                           │            │
                           │            └──< ClassSubjectLink >── Subject (do membro)
                           ├──< ClassInvite
                           ├──< ClassAnnouncement
                           ├──< ClassNote
                           ├──< ClassMaterial
                           └──< ClassPost ──< ClassPostCopy >── Assignment/Exam/CalendarEvent
```

**Turma ↔ Semestre.** A turma carrega `year` + `term` como escalares; cada
membro guarda **o semestre dele** em `ClassMember.semesterId`. Ao entrar, o
sistema procura o `Semester` do usuário com aquele ano/período e **cria** se
não existir — reaproveitando `semesterService.create`, que desde a Etapa 18 já
nasce com o modelo de notas pessoal.

**Turma ↔ Disciplinas.** Aqui a duplicação é inevitável e correta: a
disciplina carrega dado privado (configuração de notas, notas lançadas,
anotações). Dois níveis:

```
ClassSubject      classId, name, code?, color, teacherName?, credits?, order
ClassSubjectLink  classSubjectId, userId, subjectId
                  @@unique([classSubjectId, userId])
```

Ao entrar, para cada `ClassSubject` o sistema procura uma `Subject` do usuário
no semestre dele por nome equivalente (mesma normalização da Etapa 18: `trim`
+ minúsculas); achou, vincula; não achou, **cria**.

> **Este é o maior valor isolado da funcionalidade:** entrar numa turma monta o
> seu semestre. O calouro entra com um código e ganha seis disciplinas
> configuradas, com N1/N2/N3, em vez de cadastrar tudo à mão. Vale mais que o
> quadro de avisos.

**Vínculo direto por id (refinamento pós-lançamento).** O casamento por nome é
frágil pro DONO: se ele digitar a disciplina-molde com um nome levemente
diferente do que sua própria `Subject` já usa (acento, plural, "I" vs sem
número), o vínculo falha silenciosamente e ele ganha uma disciplina nova e
vazia em vez de vincular na que já tinha. Por isso `classSubjectInputSchema`
aceita um `existingSubjectId` opcional: ao criar a turma ou adicionar uma
disciplina, o dono pode escolher entre digitar do zero **ou** escolher de uma
lista das próprias disciplinas — nesse caso o vínculo é criado direto pelo id,
sem depender do nome bater. Vale só para o dono (é ele quem monta o molde);
os demais membros continuam pelo casamento por nome de sempre ao entrar, sem
mudança nenhuma nesse fluxo.

**Outros três ajustes do mesmo lote (feedback de uso real):**
- **"Semestre", não "Período"** no formulário de criação da turma — o campo é
  1 ou 2 (metade do ano civil) e dirige a mesma lógica de datas do `Semester`
  pessoal (Etapa 18); "período" no vocabulário do curso é cumulativo
  (8º período = 4 anos), um conceito diferente que não é rastreado como campo
  — continua expressável no nome livre da turma (ex.: "8º Período — Sistemas
  de Informação", como já estava no mockup original desta seção).
- **Atividade e prova da turma perderam o campo de hora**, ficando só data —
  alinhado com as telas pessoais equivalentes, que já eram só data; a
  inconsistência era exclusiva do fluxo de publicação da turma. Evento
  continua com data e hora (mesmo comportamento do Calendário pessoal).
- **Créditos saiu da criação/edição de `ClassSubject`** — o campo continua
  existindo no modelo (e ainda entra no cálculo de CR de quem já tinha
  preenchido), só não é mais pedido nesse formulário; quem quiser, edita
  depois na disciplina pessoal.

`subjectId` **não** é único em `ClassSubjectLink`: a mesma disciplina do
usuário pode ser alvo de vínculos de turmas diferentes.

**Renomear propaga.** O dono edita o `ClassSubject` ("Redes de Computadores"
virou "Redes de Computadores I") e o novo nome é escrito em toda `Subject`
vinculada — o membro não tem como divergir esse campo, já que quem manda no
nome da disciplina da turma é o dono, não ele. Mesmo mecanismo de escrita
direta usado no *fan-out* do `ClassPost`, só que sem `detachedAt`: aqui não há
"minha versão", é sempre o nome do dono.

**Individual × compartilhado.**

```
ClassPost      classId, classSubjectId?, kind (ASSIGNMENT|EXAM|EVENT), ...
ClassPostCopy  classPostId, userId, assignmentId?/examId?/calendarEventId?
               detachedAt?   -- o membro editou; a propagação não o alcança mais
               @@unique([classPostId, userId])
```

Na cópia pessoal, um único campo discrimina a origem: `classPostId` anulável
em `Assignment`, `Exam` e `CalendarEvent`. Não-nulo = selo "Da turma" — mesmo
padrão do `source: GOOGLE_CLASSROOM` que já existe.

Editar a cópia marca `detachedAt` e a propagação futura pula: o membro mantém
o dado dele sem que o sistema precise travar campo nenhum.

**As notas continuam privadas por construção**, não por regra lembrada: a
`Grade` pendura na `Subject` do membro, e a API da turma nunca expõe nota.

**O que é compartilhado de verdade** (sem cópia): avisos, anotações,
materiais, membros e convites. São superfícies novas, sem estado por usuário,
e não conflitam com nada.

**Materiais não sofrem *fan-out*** — duplicar 40 vezes um PDF de 8 MB no R2 é
desperdício direto de dinheiro. `ClassMaterial` é linha única, reaproveitando o
`StorageProvider`, a validação por *magic bytes* e o `multer` existentes. A
**única alteração em código existente** de toda a funcionalidade: a
autorização de `GET /attachments/:id/download` passa de "é dono" para "é dono
**ou** membro da turma dona".

### Papéis e permissões

**OWNER + MEMBER apenas.** `MODERATOR` dobra a matriz de permissões e a
interface para um caso que ainda não existe; adicionar depois é aditivo
(uma linha no enum), remover depois é migração com dado. Fica como FUTURO.

| Ação | OWNER | MEMBER |
| --- | :---: | :---: |
| Editar a turma, adicionar/remover disciplinas | ✅ | — |
| Convidar, remover membros, revogar convite | ✅ | — |
| Publicar atividade, prova, evento | ✅ | — |
| Publicar aviso e anotação | ✅ | — |
| **Publicar material** | ✅ | ✅ |
| Excluir material | qualquer | só o próprio |
| Arquivar/desarquivar a turma (ver Etapa 24 — substitui excluir) | ✅ | — |
| Transferir propriedade (Etapa 24) | ✅ | — |
| Sair da turma | (transfere antes, ou arquiva) | ✅ |

Um middleware `classGuard` resolve a associação **antes** de qualquer handler:
`assertMembership(userId, classId) -> { role } | 404`. **404 e não 403** para
não-membro — 403 confirma que a turma existe e permite enumeração de ids.

Vetores de vazamento a fechar, cada um virando um teste:

| Vetor | Regra |
| --- | --- |
| Download de material por não-membro | autorização por associação, não por posse |
| Listagem de membros | expõe só `name`, `avatarUrl`, `role` — nunca e-mail |
| Publicação | valida que `classSubjectId` pertence à turma do `classId` |
| Propagação | escreve só em membros ativos, só no que a turma criou |
| Sair da turma | não pode apagar dado de ninguém |
| Convite | token opaco, **hash SHA-256** no banco (padrão do `RefreshToken`) |
| Força bruta no código | *rate limit* dedicado em `POST /classes/join` |

### Convites

Turma é **privada, só por convite** — sem busca pública, sem descoberta por
instituição. Moderação e *spam* são um projeto à parte.

| Mecanismo | Veredito |
| --- | --- |
| **Código curto** (`7PER2026`) | ESSENCIAL — é o que se digita num grupo de WhatsApp |
| **Link** | ESSENCIAL — mesmo token, um toque |
| **QR Code** | IMPORTANTE — renderização do link, 100% frontend, e o cenário é presencial |
| Convite direcionado por e-mail | **FUTURO, bloqueado** — ver "E-mail" abaixo |

`ClassInvite` com `tokenHash`, `expiresAt`, `maxUses`, `usedCount`,
`revokedAt`, `createdBy`. O código curto é um convite de vida longa e
rotacionável; o link é o mesmo objeto exposto por URL.

### Notificações saem quase de graça

A varredura da Etapa 19 gera notificação a partir de `Assignment` e `Exam`
**do próprio usuário**. Como o *fan-out* cria exatamente essas linhas para cada
membro, **"prova da turma daqui a 2 dias" já notifica sem uma linha de código
nova**. Sobram só os avisos, que precisam de um `NotificationType` novo —
migração aditiva. É mais um argumento a favor da cópia.

### Classificação das funcionalidades

| Item | Classificação | Justificativa |
| --- | --- | --- |
| Turma, membros, convite | **ESSENCIAL** | sem isso não há funcionalidade |
| Disciplinas + montagem do semestre ao entrar | **ESSENCIAL** | maior valor isolado |
| Provas, atividades e eventos compartilhados | **ESSENCIAL** | o pedido central |
| Quadro de avisos | **ESSENCIAL** | é o que faz voltar à turma; barato |
| Sair / arquivar turma | **ESSENCIAL** | sem saída, turma morta polui |
| Materiais compartilhados | **IMPORTANTE** | alto valor, módulo já existe |
| Transferência de OWNER | **IMPORTANTE** | representante muda todo semestre |
| Notificações da turma | **IMPORTANTE** | quase de graça (acima) |
| QR Code | **IMPORTANTE** | frontend puro |
| Anotações da turma | **IMPORTANTE** | Tiptap já existente, **um autor** — nada colaborativo |
| Fixar aviso | **IMPORTANTE** | um booleano |
| Comentários em avisos | **FUTURO** | vira moderação, denúncia, notificação — projeto próprio |
| Feed | **FUTURO** | ou tabela de eventos, ou união cara de 5 tabelas; a Visão geral entrega 80% |
| Enquetes | **FUTURO** | valor real (marcar data de prova), mas é um módulo inteiro |
| Estatísticas da turma | **FUTURO, com ressalva** | ⚠️ média de turma **revela nota individual** em turma pequena; exige mínimo de amostra |
| MODERATOR | **FUTURO** | dobra a matriz de permissões sem demanda |
| Reações | **DESNECESSÁRIO** | ruído social num app de organização |
| Checklist / tarefas compartilhadas | **DESNECESSÁRIO** | é a atividade compartilhada com outro nome |

### Layout

Cinco abas, e não oito. "Turmas" entra na seção Geral da sidebar.

```
┌─────────────────────────────────────────────────────────┐
│  ▌ 7º Período — 2026.2          Sistemas de Informação  │
│    6 disciplinas · 24 membros              [Convidar ▾] │
├─────────────────────────────────────────────────────────┤
│  Visão geral │ Mural │ Disciplinas │ Materiais │ Membros │
└─────────────────────────────────────────────────────────┘

┌── Próximos 7 dias ──────────┐  ┌── Avisos fixados ──────┐
│ 🔴 Prova N1 — Redes   sex   │  │ 📌 Prova de Redes      │
│ 🟡 Lista 3 — BD       dom   │  │    mudou para sexta    │
└─────────────────────────────┘  └────────────────────────┘
┌── Disciplinas ──────────────────────────────────────────┐
│ [Redes] [Banco de Dados] [IA] [Compiladores] [TCC]      │
└─────────────────────────────────────────────────────────┘
```

**"Atividades", "Provas" e "Calendário" não viram abas.** Elas já existem como
telas do app, e o *fan-out* faz o item da turma aparecer lá naturalmente com o
selo "Da turma". Duplicar essas listas dentro da turma criaria duas telas de
provas que precisam concordar — exatamente o bug de médias divergentes que a
Etapa 17 existiu para consertar. A Visão geral mostra o recorte próximo; o
resto é o módulo normal, filtrável por turma.

**"Mural" reúne avisos e anotações** — são a mesma coisa em dois formatos
(efêmero e duradouro), e duas abas para dois tipos de texto é navegação
desperdiçada.

**Convidar** abre um popover com código, link e QR juntos: três formas do mesmo
convite, não três funcionalidades.

Como uma pessoa pode estar em **várias turmas no mesmo semestre** ("7º Período"
+ "Grupo de TCC"), as listagens de Atividades e Provas ganham um filtro por
turma.

### Plano por etapas

#### Etapa 20 — Fundação: turma, membros, convite, disciplinas ✅

**Objetivo.** Criar turma, entrar por código/link, e ter semestre e disciplinas
montados automaticamente. Nenhuma publicação ainda — esta etapa sozinha já tem
valor de uso.

**Banco** (aditivo; nada existente muda): `Class`, `ClassMember`,
`ClassInvite`, `ClassSubject`, `ClassSubjectLink`; enums `ClassRole` e
`ClassMemberStatus`.

**Backend.** `class.repository`, `class.service`, `class-membership.service` —
com a montagem de semestre/disciplinas como **função pura testável**, no padrão
de `grade-template-merge`. Middleware `classGuard`; *rate limit* dedicado no
join.

**Frontend.** `/turmas`; `/turmas/[id]` com Visão geral, Disciplinas e Membros;
diálogo de criação; popover de convite (código + link + QR); `/turmas/entrar/[token]`.

**Aceite.**
- Entrar numa turma com 6 disciplinas cria/vincula 6 `Subject` do membro, com o modelo de notas dele.
- Quem já tem "Redes de Computadores" é **vinculado**, não ganha duplicata.
- Não-membro recebe **404** em qualquer rota da turma.
- Convite revogado, expirado e esgotado recusam com mensagens distintas.
- Sair da turma **não apaga** disciplina nem nota.
- Dono renomeia um `ClassSubject` → toda `Subject` vinculada é atualizada com o novo nome, na mesma transação da edição.

**Testes.** Unidade da montagem (casamento por nome, acentos, caixa, duplicata,
disciplina arquivada), validados por mutação. Roteiro E2E com **dois usuários
reais**, verificando que B não enxerga nada de A.

#### Etapa 21 — Publicação compartilhada (o *fan-out*) ✅

**Objetivo.** O dono publica atividade, prova e evento; aparecem nos módulos
pessoais de cada membro com selo "Da turma".

**Banco.** `ClassPost`, `ClassPostCopy`; `classPostId` anulável em
`Assignment`, `Exam`, `CalendarEvent`. Aditivo.

**Backend.** `class-post.service`: publicação, propagação de edição (pulando
`detachedAt`), despublicação, *fan-out* retroativo para quem entra depois.
O *fan-out* usa `createMany` (uma query, não N *round trips*) — mesmo no teto
de 100 membros isso é uma única inserção em lote, bem longe do limite de
duração de função da Vercel. A propagação de edição é um `updateMany` com o
mesmo filtro (`classPostId`, `detachedAt: null`), não um loop.

**Frontend.** Formulários de publicação; selo "Da turma"; filtro por turma nas
listagens; Visão geral com os próximos 7 dias.

**Aceite.**
- Publicar prova em turma de N membros cria N cópias, cada uma na disciplina **do membro**.
- Cada membro lança **sua** nota; nenhum vê a do outro.
- Editar a data no post atualiza as cópias não divergentes; a divergente permanece.
- Quem entra depois recebe as publicações vigentes.
- Excluir o post remove as cópias.
- A prova aparece em Dashboard, Calendário e Provas **sem alteração nesses módulos**.

**Testes.** Unidade da propagação (pura), validada por mutação. E2E com 3
usuários cobrindo divergência, entrada tardia e exclusão. Teste de carga
publicando numa turma com os 100 membros do teto, medindo a duração da
requisição de publicação.

> **Nota de implementação.** O E2E com 3 usuários e a unidade da propagação
> foram executados de verdade (roteiro real contra o banco, não simulado) e
> passaram nos 14 pontos do roteiro, incluindo um bug real encontrado no
> caminho: o dono da turma não passava pelo mesmo `resolveMemberSemester` /
> `ensureMemberSubjectLink` que um membro comum usa ao entrar, então nunca
> recebia cópia das próprias publicações — corrigido fazendo o dono passar
> pelo mesmo fluxo na criação da turma. O teste de carga rodou até 29
> membros reais (a mais foi barrada pelo *rate limit* de entrada — o mesmo
> limite por IP que protege contra adivinhação de token, e que nenhuma turma
> real atinge porque cada aluno entra do próprio IP); a publicação para
> esses 29 respondeu em 63ms, e o caminho de escrita é uma única
> `createMany` por tabela independente do número de membros, então o
> resultado sustenta a mesma conclusão para 100. O filtro por turma nas
> listagens de Atividades/Provas existe na API (`?classId=`) mas ainda não
> tem controle dedicado na interface — só o selo "Da turma" foi construído
> no frontend.

#### Etapa 22 — Mural: avisos e anotações ✅

**Banco.** `ClassAnnouncement` (fixado, importante), `ClassNote` (Tiptap, mesmo
formato do `Note`), novo `NotificationType.CLASS_ANNOUNCEMENT`.

**Backend.** `class-announcement.service` e `class-note.service`: só o dono
publica (mesmo `requireOwner` do `class-post.service`); avisos usam
`notificationRepository.createMany` — uma inserção em lote para todo membro
ativo, menos o autor. Sem *fan-out* de cópia: são "compartilhados de
verdade", a mesma linha para todo mundo (ver "O que é compartilhado de
verdade" na modelagem).

**Frontend.** Aba "Mural" na turma, com as seções Avisos e Anotações;
card "Avisos fixados" na Visão geral, ao lado de "Próximos 7 dias"; diálogo
de publicação de aviso (título, conteúdo, fixar); diálogo de anotação com um
editor Tiptap compacto (negrito, itálico, título, listas) — só o dono edita,
membro só lê.

**Aceite.**
- Membro não edita nem apaga aviso alheio — verificado chamando a rota
  diretamente, não pela interface.
- Fixado aparece primeiro.
- Aviso notifica todos menos o autor.

**Testes.** Roteiro E2E com três usuários reais (dono, membro, não-membro)
contra o banco e o servidor HTTP rodando, cobrindo os três pontos do Aceite
mais o padrão de permissão das anotações e o 404 (nunca 403) para
não-membro: 22 asserções, todas passando.

#### Etapa 23 — Materiais compartilhados ✅

**Banco.** `ClassMaterial`. Sem *fan-out* — blob único, dono é a turma (`classId`),
não um usuário; `uploadedById` só registra quem publicou.

**Backend.** Reaproveita `StorageProvider`, a validação por *magic bytes* e o
`multer` do material pessoal — extraídos para `utils/attachment-content.ts`
(`sanitizeDisplayName`, mapa de MIME, `buildStorageKey` agora parametrizado
por prefixo) e importados tanto por `attachment.service` quanto por
`class-material.service`, sem duplicar a validação. **Membro pode publicar
material** e excluir o próprio; o dono exclui qualquer um.

**Frontend.** Aba "Materiais" na turma: resumo de arquivos/armazenamento **da
turma**, área de arraste para upload, diálogo de link, lista de materiais com
baixar/abrir e excluir (condicionado a dono ou autor).

**Aceite.** Não-membro recebe 404 no download mesmo com a URL exata. Membro não
consegue excluir material de outro. Cota de armazenamento contabiliza a turma,
não o membro.

**Testes.** Roteiro E2E com três usuários reais (dono, membro, não-membro)
contra o banco e o servidor HTTP rodando: 16 asserções, incluindo o
*round-trip* de bytes do upload até o download. Todas passando.

> **Nota de implementação.** O texto original desta etapa (seção "Modelagem")
> descrevia a única alteração como a autorização de `GET /attachments/:id/download`
> passar a aceitar "dono OU membro da turma dona". Optei por **não** tocar
> nessa rota: `Attachment` é 100% pessoal (`userId`, sem `classId`), e
> misturar os dois exigiria um campo novo ali E uma exceção na autorização
> de uma rota usada por todo mundo, todo dia. `ClassMaterial` é tabela e rota
> própria (`/classes/:id/materials/...`), atrás do mesmo `classGuard`
> (404-nunca-403) usado no resto de Turmas — isso também é o que deixa a
> cota "da turma, não do membro" trivial: é uma consulta `WHERE classId = ...`,
> em vez de somar `Attachment` de N usuários. O reaproveitamento pedido
> (`StorageProvider`, *magic bytes*, `multer`) foi mantido à risca; só o
> "único ponto tocado" migrou de uma autorização alterada para um utilitário
> extraído.

#### Etapa 24 — Refinamentos ✅

**Backend.**
- `classService.transferOwner`: o dono atual vira MEMBER, o escolhido (precisa
  já ser membro ativo) vira OWNER, numa transação que também move
  `Class.ownerId`. Não pode transferir para si mesmo nem para não-membro.
- `classService.archive`/`unarchive`: alterna `Class.archivedAt` (o campo já
  existia desde a Etapa 20). Turma arquivada bloqueia convite, entrada e
  publicação nova (post, aviso, anotação, material) via `assertNotArchived`
  nos quatro services de publicação; leitura, download e sair continuam
  liberados. Substitui "excluir a turma" da tabela de papéis — mesmo espírito
  de "excluir disciplina arquiva por padrão", sem dado nenhum apagado, e é
  também a saída de um dono sozinho na turma (sem outro membro para
  transferir).
- **Reconciliação de vínculos:** `ensureMemberSubjectLink` agora verifica se a
  `Subject` do outro lado do vínculo está arquivada. Se o membro a arquivou
  depois de vinculada, o vínculo não é mais reaproveitado cegamente — o
  casamento por nome roda de novo (mesma lógica da entrada) e o vínculo é
  REPOSICIONADO (`relinkSubject`) para a disciplina resolvida, nunca
  duplicado. Corrige o cenário em que uma publicação nova cairia
  silenciosamente numa disciplina que o membro já arquivou.
- `classService.health`: diagnóstico só de leitura para o dono — membros com
  alguma disciplina da turma sem vínculo, vínculos ainda apontando para
  disciplina arquivada (o que a reconciliação acima resolve na próxima
  publicação, não retroativamente) e publicações cujo nº de cópias é menor
  que o de membros ativos.

**Frontend.** Diálogo de transferência de propriedade (escolhe entre os
membros ativos); botão arquivar/desarquivar com confirmação; aviso no topo da
turma quando arquivada, com os controles de escrita desabilitados; selo
"Arquivada" na listagem; painel de saúde e as duas ações de dono reunidas
numa seção "Gestão da turma" na aba Membros.

**Testes.** Roteiro E2E real cobrindo os três fluxos junto - reconciliação
(membro arquiva a disciplina vinculada, dono publica de novo, a cópia cai
numa disciplina nova e a saúde volta a zero), transferência (self/não-membro/
não-dono rejeitados; o dono antigo perde e o novo ganha poder de dono) e
arquivamento (convite, entrada, post, aviso, anotação e material bloqueados;
leitura liberada; desarquivar restaura): 24 asserções, todas passando.

#### Etapa 25 — Envio de e-mail 🚧 planejado

**Objetivo.** Dar aos eventos que já viram notificação in-app (Etapa 19) e ao
Mural da turma (Etapa 22) um segundo canal, sem infraestrutura nova além do
que o deploy atual (Vercel + Neon, sem worker) já aguenta.

##### Decisões

| Pergunta | Decisão |
| --- | --- |
| Provedor | **Resend** — free tier (3.000 e-mails/mês), e o único dos três cotados que envia para qualquer destinatário sem domínio verificado (via `onboarding@resend.dev`) |
| Domínio | **Nenhum por enquanto.** Sem domínio próprio, o remetente é `onboarding@resend.dev` — funciona, mas carrega a marca do Resend e tem entregabilidade pior que um domínio com SPF/DKIM/DMARC. Migrar para domínio próprio depois é so trocar `EMAIL_FROM`, sem mexer em código |
| Envio | **Síncrono no request** — sem fila nem tabela de retry |
| Eventos | Aviso de turma (`CLASS_ANNOUNCEMENT`), provas/atividades próximas (`EXAM_UPCOMING`, `ASSIGNMENT_DUE`), e **convite de turma por e-mail** (pedido novo, ver abaixo) |

> ⚠️ **"Convite de turma por e-mail" é uma funcionalidade nova, não só um
> evento a mais.** O convite hoje é por link/código/QR — ninguém digita o
> e-mail de quem está convidando. Meu entendimento do pedido: o dono ganha um
> campo opcional "e-mail do convidado" no diálogo de convite já existente: ao
> preencher, o mesmo link que o link/QR usam também vai por e-mail para essa
> pessoa. **Se a intenção era outra coisa, me avise antes de eu implementar.**

> ⚠️ **Provas/atividades: 1 e-mail por dia (dígest), não 1 por evento.**
> "Síncrono no request" descreve BEM o aviso de turma e o convite — cada um
> nasce de uma ação explícita do dono (publicar, convidar), e o e-mail sai
> dentro dessa mesma requisição. Prazo é diferente: hoje a notificação de prazo
> só é gerada quando o PRÓPRIO usuário abre o dashboard (Etapa 19, "sob
> demanda") — se eu mandar e-mail nesse mesmo instante, estaria avisando por
> e-mail algo que a pessoa está *olhando na tela agora*, e ninguém recebe
> lembrete se não abrir o app nos dias que importam, exatamente quando o
> lembrete faria diferença. Por isso este item usa **Vercel Cron** (não é um
> worker persistente — só uma rota HTTP chamada 1x/dia pela própria Vercel,
> compatível com serverless) que varre todo usuário com prazo na janela e
> manda **um e-mail só, agregando tudo que é novo**, não um por atividade
> (é a preocupação do enunciado original: "avisar tudo treina a pessoa a
> ignorar"). Cada notificação recebe e-mail **uma única vez** no ciclo de vida
> dela (quando entra na janela), não todo dia que continuar pendente.

**Banco** (aditivo).
- `User.emailNotificationsEnabled Boolean @default(true)` — preferência
  global; convite por e-mail ignora essa flag (é endereçado a uma pessoa
  específica pelo dono, não é uma notificação recorrente).
- `Notification.emailedAt DateTime?` — idempotência: o dígest só pega
  notificações com `emailedAt: null`, e marca todas as incluídas ao enviar.
  Sem isso o mesmo prazo seria reavisado por e-mail a cada execução do cron.
- `EmailLog` (novo, para auditoria — ver "reputação de remetente" nas
  ressalvas originais): `id`, `userId?`, `to`, `kind` (`CLASS_ANNOUNCEMENT` |
  `DEADLINE_DIGEST` | `CLASS_INVITE`), `status` (`SENT` | `FAILED`),
  `providerMessageId?`, `error?`, `createdAt`. Não é fila nem retry — é só o
  registro que falta para diagnosticar "por que ninguém recebeu" sem precisar
  vasculhar log de aplicação.

**Backend.**
- `env.ts` ganha `EMAIL_ENABLED` (default `false`), `RESEND_API_KEY`,
  `EMAIL_FROM` (default `onboarding@resend.dev`), `CRON_SECRET` — mesmo padrão
  do `STORAGE_DRIVER=r2` (`superRefine` exige as chaves só quando
  `EMAIL_ENABLED=true`). Com a flag desligada (padrão em dev, como hoje sem
  credenciais do Google), o app funciona normalmente e só *loga* que enviaria.
- `email/` (novo, espelha `storage/`): `types.ts` (`EmailProvider.send({to,
  subject, html, text})`), `resend.ts` (implementação via pacote `resend`),
  `index.ts` (escolhe o provider pela env; um `NoopEmailProvider` quando
  desligado). Trocar de provedor no futuro (SES, domínio próprio) não toca
  em nenhum service, só em `email/`.
- `email/templates.ts`: funções puras `buildClassAnnouncementEmail`,
  `buildDeadlineDigestEmail`, `buildClassInviteEmail` — cada uma devolve
  `{subject, html, text}`. Puras e testáveis sem rede, no mesmo padrão de
  `notification-rules.ts`. HTML com CSS inline (cliente de e-mail não lê
  `<style>` externo) e um rodapé com o link de descadastro nos dois primeiros
  tipos.
- `utils/unsubscribe-token.ts`: `signUnsubscribeToken(userId)` /
  `verifyUnsubscribeToken(token)` — mesmo padrão de `jwt.ts` (segredo
  próprio, `type: 'unsubscribe'`, validade longa), para o link funcionar sem
  sessão ativa (a pessoa clica a partir do cliente de e-mail, não do app).
- `notification.service.notifyClassAnnouncement`: além de criar a
  `Notification`, envia o e-mail (se `emailNotificationsEnabled`), com
  `try/catch` isolado por destinatário — um envio que falha não pode
  interromper os demais nem a resposta ao dono que publicou.
- `email-digest.service.ts` (novo): `sendDailyDigests(now)` — para cada
  usuário com `emailNotificationsEnabled`, roda a MESMA varredura de
  `notificationService.generatePending` (garante que o dígest alcance quem
  não abre o app há dias, não só quem já tem notificação gerada), filtra
  `type in [EXAM_UPCOMING, ASSIGNMENT_DUE]` e `emailedAt: null`; se houver
  alguma, manda um e-mail e marca todas como `emailedAt: now`.
- `POST /internal/cron/email-digest`: protegida por `Authorization: Bearer
  $CRON_SECRET` (`safeCompare`, mesmo padrão de token opaco do resto do
  projeto) — nunca autenticada por sessão de usuário.
- `GET /auth/email-preferences/unsubscribe?token=...`: pública, sem
  `authenticate`; valida o token, desliga a flag, devolve uma página HTML
  estática de confirmação (não precisa de tela no SPA — é clique único a
  partir de fora do app).
- `updateProfileSchema` (já existe, hoje sem uso na interface) ganha
  `emailNotificationsEnabled?: boolean` — reaproveita a rota `PATCH
  /auth/me` que já existe, sem endpoint novo.
- `classService.createInvite`: `createClassInviteSchema` ganha
  `inviteeEmail?` (e-mail válido, opcional); quando presente, envia
  `buildClassInviteEmail` com o `joinUrl` já gerado hoje. Zero mudança no
  mecanismo de convite em si.
- `apps/api/vercel.json` ganha `"crons": [{ "path":
  "/api/v1/internal/cron/email-digest", "schedule": "0 12 * * *" }]`
  (meio-dia UTC ≈ 9h em Brasília — ajustável). **Confirmar no plano do
  Vercel em uso**: o tier Hobby historicamente permite só 1 execução/dia por
  cron, o que já é exatamente o que este dígest precisa — mas vale checar antes
  do deploy.

**Frontend.**
- `UserMenu` (menu da conta, hoje só tem "Sair"/"Sair de todos os
  dispositivos") ganha um item de alternância "Notificações por e-mail" —
  não existe tela de configurações hoje, e criar uma só para este único
  toggle seria escopo maior que o pedido.
- `ClassInviteDialog`: campo opcional "E-mail do convidado" no formulário de
  criação; ao preencher, o retorno confirma "Convite enviado para
  fulano@x.com" além do link/QR de sempre (o link continua existindo — o
  e-mail é só mais uma forma de entregar o mesmo convite).
- Página estática de confirmação de descadastro (servida pela própria API,
  não pelo Next — é o destino do link de e-mail).

**Aceite.**
- Publicar um aviso de turma envia e-mail para todo membro com a preferência
  ligada, menos o autor (mesma regra do in-app, Etapa 22).
- Uma prova/atividade que entra na janela de aviso gera **um único** e-mail
  na vida da notificação, mesmo que o cron rode todo dia até o prazo chegar.
- Dois prazos na mesma janela pro mesmo usuário no mesmo dia viram **um**
  e-mail (dígest), não dois.
- Desligar a preferência (toggle ou link de descadastro) para o envio de
  aviso e dígest; convite por e-mail continua indo mesmo com a preferência
  desligada (é endereçado, não é notificação recorrente).
- `EMAIL_ENABLED=false` (padrão sem credenciais) não quebra nada — só não
  envia, e registra em log.
- Convite por e-mail leva exatamente ao mesmo `joinUrl` que o link copiável.

**Testes.** Unidade dos três templates (`email/templates.ts`) e do filtro do
dígest (quais notificações entram, idempotência via `emailedAt`) — puros,
sem rede. Envio real de ponta a ponta fica de fora dos automatizados (exige
credencial do Resend); a verificação manual é: configurar `EMAIL_ENABLED=true`
com uma chave de teste do Resend, publicar um aviso numa turma de teste, e
conferir o e-mail recebido.

**Fora do escopo desta etapa** (ver ressalvas originais, ainda válidas):
tratamento de *bounce*/reclamação de spam via webhook do provedor (o
`EmailLog` guarda o que foi tentado, mas não fecha o ciclo de supressão
automática); domínio próprio com SPF/DKIM/DMARC (documentado como upgrade,
não bloqueia o lançamento); preferência por tipo de evento (só existe o
toggle global) — qualquer um desses vira FUTURO se a necessidade aparecer.

#### Etapa 26 — Futuro (não detalhar agora)

Feed, comentários, enquetes, MODERATOR, estatísticas da turma com mínimo de
amostra.

### Decisões já tomadas

| Pergunta | Decisão |
| --- | --- |
| Descoberta de turma | **Só por convite.** Sem busca pública |
| Ao sair da turma | **Mantém tudo** — as cópias viram itens pessoais, `classPostId` zerado. A nota lançada é do aluno |
| Quem pode publicar | **Dono publica tudo; membro publica materiais** |
| Várias turmas no mesmo semestre | **Sim** — o modelo suporta; as listagens ganham filtro por turma |
| E-mail | **Planejado** — Resend, síncrono, dígest diário de prazos via Vercel Cron (Etapa 25) |

## Banco de dados

### ⚠️ `grade_configuration_components` não é segura em banco com notas

A migração `20260810175645_grade_configuration_components` **falha** se a tabela
`grades` tiver linhas no momento em que for aplicada:

```
ERRO: a coluna "gradeComponentId" da relação "grades" contém valores nulos
```

Ela adiciona `gradeComponentId` como `NOT NULL` sem popular as linhas
existentes — e, no mesmo passo, descarta `grades.type`, `grades.weight` e
`subjects.passingGrade` sem convertê-los em componentes. Em banco **vazio**
(instalação nova, ou produção antes de qualquer nota lançada) ela passa sem
ruído; num banco em uso, quebra.

Pior: ela falha **no meio**, deixando objetos parcialmente criados. Cada nova
tentativa esbarra num ponto diferente ("índice não existe", "coluna já
existe"). Para destravar, reverta manualmente o que ficou pela metade e só
então marque como revertida:

```sql
ALTER TABLE "exams"  DROP COLUMN IF EXISTS "gradeComponentId";
ALTER TABLE "grades" DROP COLUMN IF EXISTS "gradeComponentId";
DROP TABLE IF EXISTS "grade_components" CASCADE;
DROP TABLE IF EXISTS "grade_configurations" CASCADE;
CREATE INDEX IF NOT EXISTS "grades_subjectId_type_idx" ON "grades"("subjectId","type");
```

```bash
npx prisma migrate resolve --rolled-back 20260810175645_grade_configuration_components
npx prisma migrate deploy
```

**O SQL não foi reescrito de propósito.** A migração já consta como aplicada
onde importa, e editar o arquivo mudaria o checksum que o Prisma compara —
transformando um problema pontual em divergência permanente. Um banco que
precise preservar notas antigas deve ganhar uma migração **nova**, que crie os
componentes a partir de `type`/`weight` e ligue as notas existentes antes de
impor o `NOT NULL`.



20 entidades. Toda entidade de usuário usa `onDelete: Cascade` — remover a conta remove os dados derivados.

| Entidade        | Papel                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `User`          | Conta, preferências e tokens do Google                                   |
| `RefreshToken`  | Sessões ativas (hash SHA-256, revogáveis individualmente)                |
| `Semester`      | Período letivo; base do Histórico                                        |
| `Teacher`       | Professor, vinculável a várias disciplinas                               |
| `Subject`       | Disciplina, com cor e situação                                           |
| `Assignment`    | Atividade manual **ou** importada do Classroom (`source` discrimina)     |
| `Exam`          | Prova com data, conteúdo e componente de nota vinculado (o peso vem do componente) |
| `Grade`         | Nota avulsa ou vinculada a uma prova/atividade                           |
| `GradeConfiguration` | Componentes de avaliação e nota de aprovação — de uma disciplina, ou modelo padrão de um semestre |
| `GradeComponent` | Um componente de avaliação configurável (ex.: "N1", peso 3)             |
| `CalendarEvent` | Evento manual ou do Google Calendar                                      |
| `Attachment`    | Material: upload, link ou arquivo do Classroom/Drive                     |
| `NoteFolder`    | Pasta de anotações de uma disciplina, com aninhamento livre              |
| `Note`          | Anotação de texto rico presa a uma disciplina ou pasta                   |
| `StudySession`  | Bloco de estudo planejado ou gerado pelo cronograma                      |
| `Notification`  | Avisos de prazo, prova e sincronização, com prioridade (Etapa 19)        |
| `Deck`          | Baralho de flashcards, opcionalmente ligado a uma disciplina             |
| `Flashcard`     | Cartão com frente, verso e o estado do SM-2                              |
| `FlashcardReview` | Log append-only de cada revisão; base da sequência e da retenção       |
| `StudyAvailability` | Janelas semanais em que o aluno consegue estudar                     |

Como a duplicação é evitada na sincronização: `googleCourseId`, `googleCourseWorkId` e `googleEventId` são únicos **por usuário** (`@@unique([userId, ...])`). Reimportar atualiza o registro existente em vez de criar cópia — e duas contas ainda podem importar a mesma turma.

Para inspecionar visualmente:

```bash
npm run db:studio
```

## Scripts

Todos executados a partir da raiz.

| Script                | Ação                                                  |
| --------------------- | ----------------------------------------------------- |
| `npm run dev`         | Sobe shared (watch), API e Web em paralelo            |
| `npm run dev:api`     | Apenas a API                                          |
| `npm run dev:web`     | Apenas o frontend                                     |
| `npm run build`       | Build de produção dos três pacotes                    |
| `npm test`            | Suíte de testes (Vitest)                              |
| `npm run test:watch`  | Testes em modo observação                             |
| `npm run typecheck`   | Verificação de tipos (inclui os testes)               |
| `npm run lint`        | ESLint                                                |
| `npm run lint:fix`    | ESLint com correção automática                        |
| `npm run format`      | Prettier                                              |
| `npm run db:migrate`  | Cria e aplica migration (desenvolvimento)             |
| `npm run db:deploy`   | Aplica migrations pendentes (produção)                |
| `npm run db:seed`     | Popula dados de desenvolvimento                       |
| `npm run db:studio`   | Prisma Studio                                         |
| `npm run db:reset`    | **Apaga** o banco, reaplica migrations e roda o seed  |
| `npm run docker:up`   | Sobe os containers                                    |

## Testes

```bash
npm test          # execução única
npm run test:watch
```

**122 testes**, sobre as regras puras — repetição espaçada, gerador de cronograma, cálculo de notas e os contratos Zod. São elas que concentram a lógica de negócio e, na prática, foi nelas que os bugs apareceram.

### O que os testes protegem

Cada bloco existe por causa de um bug real que aconteceu durante o desenvolvimento:

| Teste | Bug que ele impede de voltar |
| --- | --- |
| `contracts.test.ts` — defaults no PATCH | `.partial()` não remove `.default()`: editar a sala de uma prova zerava o peso dela; editar o rótulo de uma nota dividia o valor por dez; editar o título de uma atividade devolvia uma tarefa concluída para pendente |
| `contracts.test.ts` — `booleanQueryParam` | `Boolean("false")` é `true`: `?permanent=false` **apagava** uma disciplina que deveria só ser arquivada |
| `spaced-repetition.test.ts` — piso do ease factor | sem o piso de 1,3, um cartão errado muitas vezes ficaria preso repetindo todo dia para sempre |
| `schedule-generator.test.ts` — prazo e sobreposição | blocos agendados depois do próprio prazo, ou em cima de compromissos existentes |
| `grade-template-merge.test.ts` — fusão aditiva | propagar o modelo de um semestre apagando um componente que só a disciplina tinha — e, com ele, a nota lançada nesse componente |
| `grade-calculator.test.ts` — agrupamento por componente | dois lançamentos no mesmo componente contavam o peso duas vezes; e uma nota parcial (`isFinal: false`) era descartada inteira da projeção |
| `contracts.test.ts` — data local | `"2026-10-05"` lido como meia-noite UTC: prova cadastrada para 05/10 aparecia como 04/10 no calendário |
| `notification-rules.test.ts` — dia de calendário | comparar prazos por 24 horas corridas fazia a atividade que vence hoje às 9h aparecer como atrasada às 14h |
| `notification-rules.test.ts` — escalonamento | estados diferentes precisam gerar conteúdo diferente (senão o texto não atualiza) e o mesmo estado precisa gerar conteúdo idêntico (senão a notificação dispensada volta ao sino) |

> **Ao rodar verificações manuais em sequência, atenção ao rate limit.** A API
> permite 300 requisições por 15 minutos por IP (`RATE_LIMIT_MAX`). Um roteiro
> longo de verificação contra o servidor local esbarra nesse teto e passa a
> receber `429` — o limitador funcionando como projetado, não uma falha. Espere
> a janela ou eleve o valor **apenas no ambiente de teste**.

Os testes foram **validados por mutação**: cada regra foi quebrada de propósito e confirmou-se que o teste correspondente falha. Um teste que passa com a regra quebrada não protege nada.

O fuso é fixado em `America/Sao_Paulo` na configuração do Vitest: várias regras dependem de "meia-noite local", e sem isso a suíte passaria na máquina de quem escreveu e falharia numa esteira rodando em UTC.

### O que NÃO está aqui, e por quê

Testes que exigem banco ficam fora da suíte: eles precisam de um Postgres dedicado com carga e limpeza a cada execução, o que é uma decisão de infraestrutura separada. Durante o desenvolvimento, cada etapa foi verificada contra o servidor real e num navegador real (Chromium via Playwright) — cobrindo endpoints, fluxos de tela, responsividade em 320/375/768px e ausência de erros de JavaScript. Esses roteiros não estão versionados; formalizá-los como suíte de integração é o próximo passo natural do projeto.

## Docker

```bash
cp .env.example .env
npm run docker:up
npm run docker:logs
```

O Postgres do compose expõe a porta **5433** no host, evitando conflito com um PostgreSQL já instalado na 5432. Ao usar o compose, ajuste `DATABASE_URL` em `apps/api/.env` para `localhost:5433`.

Os Dockerfiles são multi-stage com alvos `development` e `production`; o compose usa `development` (hot reload por volume). Em produção os containers rodam com usuário sem privilégios.

## Deploy (Docker)

```bash
# 1. Variáveis de produção (todas obrigatórias — o compose falha sem elas)
cp .env.example .env.production && $EDITOR .env.production

# 2. Subir
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 3. Aplicar as migrações
docker compose -f docker-compose.prod.yml exec api npm run db:deploy
```

### O que difere da composição de desenvolvimento

| | Desenvolvimento | Produção |
| --- | --- | --- |
| Alvo da imagem | `development` | `production` (compilado, usuário sem privilégios) |
| Código | montado por volume | embutido na imagem |
| Postgres | porta exposta no host | só na rede interna |
| Uploads | pasta local | **volume nomeado** |
| Healthcheck | não | em todos os serviços |
| Migrações | `db:migrate` (interativo) | `db:deploy` (não interativo) |

### Dois pontos que quebram um deploy silenciosamente

**Os uploads precisam de volume.** O provider de storage local grava em `UPLOAD_DIR`. Sem o volume nomeado, todo material enviado pelos usuários desaparece no primeiro restart do container. Ao migrar para armazenamento de objetos, o volume sai junto com o provider.

**`NEXT_PUBLIC_API_URL` é embutido em tempo de BUILD.** O Next injeta as variáveis `NEXT_PUBLIC_*` no bundle do navegador durante a compilação; passá-las apenas como environment do container não tem efeito nenhum — o código já foi compilado com o valor antigo. Por isso ela é um `ARG` do Dockerfile, não uma variável de runtime.

### Fora do escopo desta composição

Terminação TLS, proxy reverso, backup do Postgres e agregação de logs. São escolhas de infraestrutura que dependem de onde o projeto vai rodar; o compose entrega os contêineres prontos para receber tráfego atrás delas.

## Deploy (Vercel + Neon + R2)

Alternativa sem servidor para rodar sem gerenciar container nenhum: **dois projetos Vercel** (um para `apps/web`, outro para `apps/api`), banco no **Neon** e materiais no **Cloudflare R2**. `apps/web/vercel.json` e `apps/api/vercel.json` já trazem o `buildCommand` que compila `packages/shared` antes de cada app — a Vercel os lê sozinha ao detectar o projeto.

Custo esperado para uso pessoal: **$0**, nos planos gratuitos dos três. Ressalva: o plano Hobby da Vercel é para uso pessoal/não-comercial — um produto com outros usuários exigiria o plano Pro.

### 1. Banco (Neon)

1. Crie um projeto em [neon.tech](https://neon.tech).
2. No painel, copie duas connection strings: a **pooled** (host com sufixo `-pooler`) e a **direta**.
3. Guarde as duas — vão virar `DATABASE_URL` (pooled) e `DIRECT_DATABASE_URL` (direta) no projeto da API.

A aplicação roda sob `DATABASE_URL` pooled porque cada invocação serverless pode abrir sua própria conexão TCP; sem pooler, um pico de tráfego esgota o limite de conexões do Postgres. Migrações usam a direta porque o pooler em modo transação (o do Neon) não sustenta os comandos DDL que `migrate` emite — ver `prisma.config.ts`.

### 2. Arquivos (Cloudflare R2)

1. No painel da Cloudflare, crie um bucket R2 (ex.: `painel-faculdade-materiais`).
2. Em **Manage API tokens**, crie um token com permissão *Object Read & Write* restrito a esse bucket.
3. Anote **Account ID**, **Access Key ID**, **Secret Access Key** e o **nome do bucket**.

Não é preciso expor o bucket publicamente: o download continua passando pela rota autenticada da API (ver [Materiais](#materiais)), que busca o objeto no R2 e faz o stream para o cliente.

### 3. API (`apps/api` → projeto Vercel)

Novo projeto na Vercel apontando para este repositório, com:

- **Root Directory**: `apps/api`
- **Framework Preset**: Other

Variáveis de ambiente (Production e Preview):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | connection string *pooled* do Neon |
| `DIRECT_DATABASE_URL` | connection string direta do Neon |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `openssl rand -base64 48`, um valor **diferente** para cada |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | do Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://<domínio-do-**web**>/api/v1/auth/google/callback` — ver [Por que a API é servida pelo domínio do frontend](#por-que-a-api-é-servida-pelo-domínio-do-frontend) |
| `WEB_APP_URL`, `CORS_ORIGINS` | `https://<domínio-do-web>` |
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | do passo 2 |
| `NODE_ENV` | `production` |

Depois do primeiro deploy, aplique as migrações **manualmente**, de uma máquina com a `DIRECT_DATABASE_URL` no ambiente — não roda automaticamente a cada push, pelo mesmo motivo do compose Docker (uma migração não é algo para disparar sem querer num preview deploy):

```bash
DATABASE_URL="<direct-url-do-neon>" npm run db:deploy --workspace @painel/api
```

O domínio do Google Cloud Console (**Authorized redirect URIs**) precisa ser atualizado com a `GOOGLE_REDIRECT_URI` real antes do login funcionar.

### 4. Web (`apps/web` → projeto Vercel)

Segundo projeto Vercel, mesmo repositório:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (detectado automaticamente)

Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api/v1` — **caminho relativo**, não a URL da API |
| `NEXT_PUBLIC_APP_NAME` | `Painel Faculdade` |

Como já vale para o Docker: `NEXT_PUBLIC_*` é embutido no bundle em **tempo de build**. Definir a variável depois do primeiro deploy exige um redeploy para ter efeito.

### Por que a API é servida pelo domínio do frontend

`apps/web/vercel.json` reescreve `/api/*` para o domínio da API. Assim o navegador
enxerga **um só site**, e o cookie de sessão é *first-party*.

Sem isso, `web.vercel.app` e `api.vercel.app` são sites diferentes — e como
`vercel.app` está na *Public Suffix List*, nem dá para compartilhar cookie entre
os subdomínios. O cookie da API vira **cookie de terceiro**, que o Brave bloqueia
por padrão e o Chrome vem restringindo. O sintoma é traiçoeiro: o login
**funciona** (o log registra "Login realizado"), mas o `POST /auth/refresh`
seguinte responde 401 porque o navegador não devolve o cookie — e o usuário vê
"Não foi possível entrar" sem nenhuma pista.

Duas consequências para a configuração:

- **`GOOGLE_REDIRECT_URI` aponta para o domínio do WEB**, não o da API:
  `https://<domínio-do-web>/api/v1/auth/google/callback`. O retorno do Google
  precisa chegar pelo mesmo domínio, senão o cookie é gravado no domínio da API
  e o problema volta. Esse é o valor que vai no **Authorized redirect URIs** do
  Google Cloud Console.
- **O `destination` do rewrite tem o domínio da API fixo.** Se ele mudar, ajuste
  `apps/web/vercel.json` junto.

O `NEXT_PUBLIC_API_URL` relativo é o que faz o cliente chamar o próprio domínio;
a URL absoluta continua funcionando em desenvolvimento, onde front e API rodam em
portas diferentes e o cookie é `SameSite=Lax` no mesmo `localhost`.

### `husky: command not found` no build

Se o build da Vercel parar em `npm install` com `code 127`:

```
sh: line 1: husky: command not found
npm error command failed
```

O script `prepare` do npm roda logo após o install e chama o `husky`. Mas o
build de produção instala sem `devDependencies` — e o `husky` é uma delas, então
o binário não existe e o npm derruba o install inteiro.

Por isso o script é `husky || true`: hooks de git não têm sentido num build de
CI, e a ausência deles não pode impedir o deploy. Localmente nada muda — o
`husky` está instalado e configura o `core.hooksPath` normalmente.

### O que é diferente aqui, e por quê

**Rate limit por instância, não global.** `express-rate-limit` guarda os contadores em memória do processo. Em funções serverless cada instância fria tem sua própria memória, então o limite efetivo é "por instância ativa", não um teto global preciso como no Docker (processo único de longa duração). Para um uso pessoal isso não chega a importar; se o tráfego crescer, a correção é trocar o store por um compartilhado (Redis/Upstash).

**Upload tem teto de ~4,5 MB no corpo da requisição.** É limite da própria função Vercel (runtime Node.js), aplicado antes do multer rodar — arquivos maiores que isso recebem 413 mesmo com `MAX_UPLOAD_SIZE_MB` configurado mais alto. No Docker esse teto não existe. Se materiais grandes (slides, vídeos) forem comuns, vale baixar `MAX_UPLOAD_SIZE_MB` para refletir o limite real ou avaliar upload direto do navegador para o R2 (URL pré-assinada), fora do escopo desta preparação.

## Padrões de código

- **TypeScript estrito.** `any` é erro de lint, não aviso.
- **Sem regra de negócio em controller.** Toda lógica vive em `services/`.
- **Prisma só em repositories.**
- **Erros previsíveis** usam `AppError`; o resto vira 500 sem vazar detalhes internos em produção.
- **Comentários explicam o porquê**, não o quê.
- **`.partial()` do Zod NÃO remove `.default()`.** Um schema de update derivado de `createSchema.partial()` aplica os defaults nos campos ausentes — e um PATCH parcial sobrescreve silenciosamente o que não foi enviado. Por isso cada entidade tem um `xBaseSchema` **sem defaults**: a criação faz `base.extend({...defaults})` e a edição faz `base.partial()`.
- **Mensagens de validação em português**, inclusive para campo ausente ou vazio. `z.string().min(2, 'msg')` cobre só o `min`; para o campo faltando é preciso `z.string({ error: 'msg' })`, e para campo vazio vindo de formulário a mensagem também precisa estar no `.min(1, 'msg')`.

O Husky roda `lint-staged` no pre-commit: ESLint e Prettier nos arquivos em stage.

## Roadmap

| # | Etapa | Status |
|---|-------|--------|
| 1 | Ambiente, Docker, Prisma, PostgreSQL, ESLint, Prettier | ✅ |
| 2 | Autenticação (Google OAuth, JWT, middleware) | ✅ |
| 3 | Layout, Sidebar, Navbar, Dashboard | ✅ |
| 4 | CRUD de Disciplinas | ✅ |
| 5 | CRUD de Atividades | ✅ |
| 6 | CRUD de Provas | ✅ |
| 7 | Calendário | ✅ |
| 8 | Integração Google Classroom | ✅ |
| 9 | Integração Google Calendar | ✅ |
| 10 | Controle de Notas | ✅ |
| 11 | Histórico | ✅ |
| 12 | Upload de Materiais | ✅ |
| 13 | Flashcards | ✅ |
| 14 | Cronograma de Estudos | ✅ |
| 15 | Estatísticas | ✅ |
| 16 | Testes, refatoração, documentação, deploy | ✅ |
| 17 | Notas configuráveis (componentes de avaliação, Simulação) | ✅ |
| 18 | Modelo de semestre sólido (padrão N1/N2/N3, propagação para disciplinas) | ✅ |
| 19 | Busca global (⌘K) e central de notificações | ✅ |
| 20 | Turmas: fundação (turma, membros, convite, disciplinas) | ✅ |
| 21 | Turmas: publicação compartilhada (atividades, provas, eventos) | ✅ |
| 22 | Turmas: mural (avisos e anotações) | ✅ |
| 23 | Turmas: materiais compartilhados | ✅ |
| 24 | Turmas: refinamentos (transferência de dono, arquivamento) | ✅ |
| 25 | Envio de e-mail | 🚧 planejado |
| 26 | Autenticação: e-mail + senha, vínculo com Google (10 etapas próprias — ver seção dedicada) | 🚧 planejado |

Contribuições: veja [CONTRIBUTING.md](CONTRIBUTING.md).
