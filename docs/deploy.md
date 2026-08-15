# Deploy

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

**`argon2` (hash de senha, Etapa 26) precisa do runtime Node, nunca Edge.** O pacote é um binário nativo prebuilt — mesma exigência que `@prisma/client` já impõe às funções da API, então não é uma restrição nova. Confirme no primeiro deploy que o login/cadastro por senha funciona de ponta a ponta; se o binário não cobrir o runtime da Vercel, o plano B é trocar por `bcrypt`/`bcryptjs` só em `apps/api/src/utils/password.ts`, sem mexer em mais nada.

**Upload tem teto de ~4,5 MB no corpo da requisição.** É limite da própria função Vercel (runtime Node.js), aplicado antes do multer rodar — arquivos maiores que isso recebem 413 mesmo com `MAX_UPLOAD_SIZE_MB` configurado mais alto. No Docker esse teto não existe. Se materiais grandes (slides, vídeos) forem comuns, vale baixar `MAX_UPLOAD_SIZE_MB` para refletir o limite real ou avaliar upload direto do navegador para o R2 (URL pré-assinada), fora do escopo desta preparação.


