# CLAUDE.md — `painel-faculdade`

Plataforma de organização acadêmica para estudantes universitários: disciplinas, turmas, atividades, provas, notas, flashcards (SM-2), cronograma de estudos, integração com Google Classroom/Calendar.

## Stack

- **Runtime/linguagem:** Node ≥ 20.19 · TypeScript 5.9 (estrito — `any` é erro de lint)
- **Framework:** Express 5 (`apps/api`) · Next 16 App Router (`apps/web`)
- **Dados:** PostgreSQL 18 + Prisma 7 (`apps/api/prisma/schema.prisma`, 20 entidades)
- **UI:** Tailwind 4 + Radix UI + `shadcn` (`apps/web/components/ui`) + TanStack Query
- **Gerenciador de pacotes:** **npm** (workspaces: `apps/*` + `packages/*`) — não troque, os scripts da raiz dependem de `--workspace`.

## Comandos

Todos rodam da raiz do repo.

```bash
npm install                              # deps (todos os workspaces)
cp .env.example .env                     # + apps/api/.env.example → apps/api/.env
                                          # + apps/web/.env.example → apps/web/.env.local
npm run db:migrate && npm run db:seed    # banco (Postgres precisa existir antes)
npm run dev                              # shared (watch) + api (:3333) + web (:3000)
npm test                                 # Vitest — testes reais, não smoke
npm run typecheck                        # tsc por workspace + tsconfig.test.json na raiz
npm run lint                             # ESLint
npm run build                            # build:shared roda antes, automaticamente
```

Ver `docs/setup.md` para geração dos segredos JWT e configuração do Google OAuth (sem eles a app sobe, mas o login não funciona).

## Estrutura

```
apps/api/src/{config,controllers,services,repositories,middlewares,routes,validators,utils}
apps/api/prisma/{schema.prisma,migrations,seed.ts}
apps/web/{app,components,hooks,services,contexts,providers,types,lib}
packages/shared/src/     # enums, schemas Zod, tipos — consumidos por api E web
```

- **Entry points:** `apps/api/src/server.ts` (app montada em `apps/api/src/app.ts`) · `apps/web/app/`
- **Onde ficam as specs/docs:** `docs/INDEX.md` é o hub → `architecture.md`, `setup.md`, `testing.md`, `deploy.md`, `code-standards.md`, `roadmap.md`, `planning/pwa.md`, e um `docs/modules/<nome>.md` por módulo de produto (autenticação, turmas, notas, flashcards, google-calendar, google-classroom, etc.). **Leia o módulo relevante antes de mexer numa feature.**

## Convenções deste repo

- **Branch default / base de PR:** `main`
- **Fluxo de camadas (backend), inviolável:** `Route → Middleware (auth, validate) → Controller → Service → Repository → Prisma`. Controller não tem regra de negócio; Service não conhece `req`/`res`; **Prisma só aparece em `repositories/`**.
- **Validators** reexportam schemas Zod de `@painel/shared` — front (React Hook Form) e back validam com o mesmo schema.
- **Erros:** previsíveis usam `AppError`; o resto vira 500 sem vazar detalhe interno em produção.
- **Comentários explicam o porquê, nunca o quê.**
- **Testes:** Vitest, `npm test`/`test:watch`. Cobertura real em `apps/api/src/utils/*.test.ts` (spaced-repetition, schedule-generator, grade-calculator, notification-rules, class-post-fields, grade-template-merge, google-link-resolution, class-subject-merge) — ver `docs/testing.md`.
- **i18n:** não tem — mensagens de validação e UI são direto em português (ver armadilha do Zod abaixo).
- Convenções de commit/branch/PR cross-repo: ver `../personal-harness/docs/CONVENTIONS.md`.

## Armadilhas conhecidas

- **`.partial()` do Zod NÃO remove `.default()`.** Um schema de update derivado de `createSchema.partial()` aplica os defaults nos campos ausentes — um PATCH parcial sobrescreveria silenciosamente o que não foi enviado. Por isso cada entidade tem um `xBaseSchema` **sem defaults**: criação faz `base.extend({...defaults})`, edição faz `base.partial()`.
- **Mensagem de campo ausente não é coberta por `.min()`.** `z.string().min(2, 'msg')` só cobre valor curto/vazio; pra campo faltando por completo é preciso `z.string({ error: 'msg' })` também.
- **`booleanQueryParam` em vez de `z.coerce.boolean`** nos query params — `Boolean("false")` é `true` em JS; num `?permanent=false` isso apagaria dados que deveriam só ser arquivados.
- **Editar `packages/shared` e não ver refletir em `api`/`web`?** Rode `npm run build:shared` manualmente — `predev`/`prebuild`/`pretypecheck` builda automaticamente, mas só nesses hooks.
- **Migration `20260810175645_grade_configuration_components` quebra em banco com notas.** Ela adiciona `gradeComponentId` `NOT NULL` sem popular linhas existentes. Em banco vazio passa liso; num banco em uso, falha no meio e deixa objetos parciais. **Nunca edite o SQL dessa migration** (quebraria o checksum do Prisma) — ver o procedimento de rollback manual em `docs/architecture.md#banco-de-dados`. Um banco que precise preservar notas antigas exige uma migration **nova**.
- **`NEXT_PUBLIC_API_URL` é embutida em build-time no bundle.** Setar só no runtime do container (Docker) não tem efeito — o Next já compilou com o valor antigo. É por isso que ela entra como `ARG` do Dockerfile, não variável de runtime.
- **Redirect URI do Google OAuth aponta pra API (`:3333`), não pro front.** A troca do código por token acontece no servidor, onde o `client_secret` fica protegido.
- **`JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` precisam ser diferentes e ter ≥32 caracteres** — a validação de ambiente (Zod, no boot) recusa subir caso contrário.
- **Postgres do `docker-compose.yml` expõe `5433`, não `5432`** — evita colisão com um Postgres já instalado localmente. Ajuste `DATABASE_URL` de acordo ao usar Docker.

## Integrações

- **Backend consumido:** nenhum — é autocontido (api + web no mesmo repo).
- **Deploy:** hoje **n/d** (nenhum ambiente publicado). `docs/deploy.md` documenta dois caminhos prontos: Docker (`docker-compose.prod.yml`) ou Vercel (dois projetos: `apps/web` + `apps/api`) + Neon (Postgres) + Cloudflare R2 (materiais).
- **Segredos:** `.env` (raiz, só Docker) + `apps/api/.env` + `apps/web/.env.local`, todos a partir dos `.env.example` correspondentes — nunca commitados. Em produção, todas as vars da API passam a ser obrigatórias (`${VAR:?}` no compose).
