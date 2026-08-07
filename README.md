# Painel Faculdade

Plataforma web de organização acadêmica para estudantes universitários. Centraliza atividades, provas, notas, materiais e cronograma de estudos em um único lugar, com integração ao Google Classroom e ao Google Calendar.

> **Status:** projeto completo — 16 de 16 etapas.

---

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Google OAuth](#google-oauth)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Autenticação](#autenticação)
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
| Frontend      | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui  |
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
│       ├── app/                     # App Router
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

### Nota necessária para aprovação

O cálculo usa dados reais, não suposições. O peso restante vem das **provas cadastradas que ainda não têm nota** — por isso vale cadastrar as provas (Etapa 6) antes de esperar uma projeção útil.

```
necessária = (aprovação × pesoTotal − pontosObtidos) ÷ pesoRestante
```

Exemplo com aprovação 6, P1 (peso 2, nota 5) lançada e P2+P3 (peso 8) pendentes:
`(6 × 10 − 10) ÷ 8 = 6,25`

Sem provas pendentes cadastradas, `requiredGrade` é **`null`** — a interface diz "cadastre as provas restantes" em vez de inventar um número.

### Situação projetada

| Status | Condição |
| --- | --- |
| Aprovado | Média já garante a aprovação mesmo zerando o restante |
| Atenção | Ainda é possível, mas exige nota ≥ 7 no que falta |
| Em andamento | Precisa de menos de 7 no restante |
| Reprovado | Nem com nota máxima alcança a média |
| Sem notas | Nada lançado ainda |

### Escalas diferentes convivem

Uma prova de 100 pontos e um trabalho de 10 são comparáveis: tudo é normalizado para 0–10 antes de ponderar. A interface mostra o valor original **e** o equivalente (`80/100 = 8,0`).

### Vínculo com provas

`Grade.examId` é único — uma prova tem no máximo uma nota. Ao lançar, dá para escolher entre as provas ainda sem nota da disciplina. O vínculo faz a lista de provas realizadas (Etapa 6) mostrar o resultado.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/grades/overview` | Boletim de todas as disciplinas em andamento |
| GET | `/grades/subject/:id` | Boletim de uma disciplina, com projeção |
| GET | `/grades` | Lista de notas (aceita `subjectId`) |
| POST | `/grades` | Lança uma nota |
| PATCH | `/grades/:id` | Atualiza |
| DELETE | `/grades/:id` | Exclui |

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

## Banco de dados

17 entidades. Toda entidade de usuário usa `onDelete: Cascade` — remover a conta remove os dados derivados.

| Entidade        | Papel                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `User`          | Conta, preferências e tokens do Google                                   |
| `RefreshToken`  | Sessões ativas (hash SHA-256, revogáveis individualmente)                |
| `Semester`      | Período letivo; base do Histórico                                        |
| `Teacher`       | Professor, vinculável a várias disciplinas                               |
| `Subject`       | Disciplina, com cor, nota de aprovação e situação                        |
| `Assignment`    | Atividade manual **ou** importada do Classroom (`source` discrimina)     |
| `Exam`          | Prova com data, conteúdo e peso                                          |
| `Grade`         | Nota avulsa ou vinculada a uma prova/atividade                           |
| `CalendarEvent` | Evento manual ou do Google Calendar                                      |
| `Attachment`    | Material: upload, link ou arquivo do Classroom/Drive                     |
| `StudySession`  | Bloco de estudo planejado ou gerado pelo cronograma                      |
| `Notification`  | Avisos de prazo, prova, nota e sincronização                             |
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

**75 testes**, sobre as regras puras — repetição espaçada, gerador de cronograma, cálculo de notas e os contratos Zod. São elas que concentram a lógica de negócio e, na prática, foi nelas que os bugs apareceram.

### O que os testes protegem

Cada bloco existe por causa de um bug real que aconteceu durante o desenvolvimento:

| Teste | Bug que ele impede de voltar |
| --- | --- |
| `contracts.test.ts` — defaults no PATCH | `.partial()` não remove `.default()`: editar a sala de uma prova zerava o peso dela; editar o rótulo de uma nota dividia o valor por dez; editar o título de uma atividade devolvia uma tarefa concluída para pendente |
| `contracts.test.ts` — `booleanQueryParam` | `Boolean("false")` é `true`: `?permanent=false` **apagava** uma disciplina que deveria só ser arquivada |
| `spaced-repetition.test.ts` — piso do ease factor | sem o piso de 1,3, um cartão errado muitas vezes ficaria preso repetindo todo dia para sempre |
| `schedule-generator.test.ts` — prazo e sobreposição | blocos agendados depois do próprio prazo, ou em cima de compromissos existentes |

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

Contribuições: veja [CONTRIBUTING.md](CONTRIBUTING.md).
