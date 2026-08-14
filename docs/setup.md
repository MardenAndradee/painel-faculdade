# Setup do ambiente de desenvolvimento

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


## Docker

```bash
cp .env.example .env
npm run docker:up
npm run docker:logs
```

O Postgres do compose expõe a porta **5433** no host, evitando conflito com um PostgreSQL já instalado na 5432. Ao usar o compose, ajuste `DATABASE_URL` em `apps/api/.env` para `localhost:5433`.

Os Dockerfiles são multi-stage com alvos `development` e `production`; o compose usa `development` (hot reload por volume). Em produção os containers rodam com usuário sem privilégios.


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


