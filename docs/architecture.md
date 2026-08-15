# Arquitetura

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
| `User`          | Conta, preferências, senha (opcional) e tokens do Google                 |
| `AuthIdentity`  | Identidade de provedor de terceiro vinculada a um usuário (Google — Etapa 26) |
| `EmailToken`    | Token de uso único para verificar e-mail ou redefinir senha (Etapa 26)   |
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


