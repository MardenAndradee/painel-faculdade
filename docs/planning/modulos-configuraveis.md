# Módulos Configuráveis + Simplificação Visual (planejado)

> **Só análise e plano — nada foi implementado.** Nenhum arquivo alterado,
> nenhuma migration criada, nenhuma dependência instalada. Este documento
> audita a interface atual, propõe a arquitetura de módulos configuráveis,
> define as regras de negócio e divide o trabalho em etapas. Três decisões de
> escopo já foram respondidas (seção "Decisões"); o resto é análise e
> proposta, para revisão antes de começar. A implementação começa na
> Etapa 29.1.

## Objetivo

Dar ao aluno controle sobre **quais módulos aparecem** na experiência
principal (Sidebar, Dashboard, busca, notificações), sem excluir nenhuma
funcionalidade, tabela ou dado. Junto, simplificar o que já está aprovado
(tirar "Sincronizar" e "Nova atividade" do Dashboard, tirar o card de usuário
da Sidebar) e propor outras reduções de ruído visual para revisão.

A regra que governa tudo: **desativar um módulo esconde, nunca apaga.**

## O que a auditoria encontrou

### Sidebar (`apps/web/lib/navigation.ts` + `components/layout/sidebar-nav.tsx`)

Itens centralizados em `NAV_SECTIONS`, consumidos pela própria Sidebar e por
`breadcrumbs.tsx` (via `findNavItem`) — já existe um único lugar que mapeia
rota → item de navegação, o que ajuda bastante o design deste plano.

| Seção | Itens |
| --- | --- |
| Geral | Dashboard, Turmas, Disciplinas, Atividades, Provas, Notas, Calendário |
| Acompanhamento | Histórico, Estatísticas |
| Sistema | Integrações |
| Estudos | Materiais, Cronograma |

Acima da lista, um **card de usuário** (avatar, nome, e-mail) só aparece se
`user` existir. **Flashcards não tem item de nav** hoje — decisão anterior
("visual atual não ficou bom, será refeita", registrada no plano do PWA) — as
rotas continuam funcionando, só não há link. **Plano de Estudos também não
tem item de nav** — é alcançado de dentro de uma Prova (`/plano-de-estudos/:id`
via "Criar/Ver plano de estudo" no menu do card de prova), nunca por um item
de topo.

### Navbar (`components/layout/app-shell.tsx`)

Da esquerda pra direita: menu hambúrguer (mobile), `Breadcrumbs`, botão de
busca (abre `CommandPalette`, atalho `⌘K`), botão **"Sincronizar"**
(só quando `user.hasClassroomAccess`), `NotificationBell`, `ThemeToggle`,
`UserMenu` (avatar com nome/e-mail, "Sair de todos os dispositivos", "Sair").

### Dashboard (`app/(app)/dashboard/page.tsx`)

`Greeting` (saudação + resumo) com dois botões — "Atualizar" e **"Nova
atividade"** (abre `AssignmentFormDialog`) — seguido de 4 `StatCard`s (Em
aberto, Atrasadas, Provas próximas, Próxima prova), um grid de 3 colunas
(Próximas atividades / Próximas provas / Calendário) e um card de Atividades
atrasadas.

### Confirmado por grep: "Nova atividade/prova/disciplina" já existe em cada página própria

`atividades/page.tsx`, `provas/page.tsx` e `disciplinas/page.tsx` já têm seu
próprio botão de criação. Tirar "Nova atividade" do Dashboard **não** cria
nenhum caminho novo — o caminho já existe, só deixa de estar duplicado em
dois lugares.

### Banco (`apps/api/prisma/schema.prisma`, 39 models)

`User` não tem nenhum campo ou tabela de preferências além de
`theme`/`timezone`/`locale` (escalares soltos). **Não existe** `UserSettings`
nem qualquer coisa parecida — confirmado por grep em `apps/api/src`,
`apps/web` e `packages/shared/src`. O padrão já estabelecido no schema para
"lista curta de valores possíveis" é: array `as const` em
`packages/shared/src/enums.ts` **espelhado** como `enum` no Prisma (ex.:
`ExamPrepItemStatus`, `NotificationType`, `ThemePreference`) — este plano
segue o mesmo padrão para os módulos, em vez de inventar um novo.

### Backend (`apps/api/src/routes/index.ts`, 18 arquivos de rota)

Cada módulo já é um arquivo de rota isolado (`subject.routes.ts`,
`assignment.routes.ts`, `exam.routes.ts`, `calendar.routes.ts`,
`grade.routes.ts`, `semester.routes.ts` [Histórico], `attachment.routes.ts`,
`flashcard.routes.ts`, `study-plan.routes.ts`, `exam-prep.routes.ts`,
`statistics.routes.ts`, `class.routes.ts`, `integration.routes.ts`) — nenhuma
rota depende de outra existir fisicamente, então desativar um módulo nunca
vai quebrar uma chamada de API de outro.

### Busca global (`search.repository.ts`)

Um único endpoint (`GET /search`) que consulta **5 tabelas em paralelo**
(`Subject`, `Assignment`, `Exam`, `CalendarEvent`, `Attachment`) via
`Promise.all`, sem passar por nenhum outro serviço. Não busca em Grade, Note,
Flashcard/Deck, StudySession, ExamPrep, Class/ClassPost/ClassMaterial nem
Notification.

### Notificações (`notification.service.ts` + `notification-rules.ts`)

Não existe worker/cron — a geração acontece **sob demanda**
(`generatePending()`, chamado toda vez que a lista ou o contador de não-lidas
é aberto). O campo `Notification.type` (`ASSIGNMENT_DUE`,
`ASSIGNMENT_OVERDUE`, `ASSIGNMENT_CREATED`, `EXAM_UPCOMING`, `GRADE_POSTED`,
`STUDY_SESSION`, `SYNC_COMPLETED`, `SYNC_FAILED`, `SYSTEM`,
`CLASS_ANNOUNCEMENT`) já mapeia 1:1 pra um módulo (ou é estrutural, no caso
de `SYSTEM`) — não precisa de campo novo, só de uma tabela de tradução
tipo↔módulo.

## Arquitetura proposta

### Banco: um enum + uma tabela esparsa

```prisma
enum AppModule {
  SUBJECTS
  ASSIGNMENTS
  EXAMS
  CALENDAR
  GRADES
  HISTORY
  MATERIALS
  FLASHCARDS
  STUDY_PLAN
  EXAM_PREP
  STATISTICS
  CLASSES
}

model UserModuleSetting {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  module    AppModule
  enabled   Boolean
  updatedAt DateTime  @updatedAt

  @@unique([userId, module])
  @@index([userId])
  @@map("user_module_settings")
}
```

**Esparsa de propósito**: só existe uma linha quando o usuário desvia do
padrão. Ausência de linha = valor padrão do módulo (definido em código, não
no banco). Consequência direta de como a Decisão #1 foi respondida ("tudo
ativado pra todo mundo"): como o padrão de quase todos os módulos já é
`enabled: true`, **nenhuma migração de backfill é necessária** — usuários
existentes não precisam ganhar 12 linhas cada, o comportamento atual já é o
padrão. Só quando alguém desativa algo é que uma linha nasce.

`AppModule` como enum do Prisma (não `String` livre) segue o padrão que o
projeto já usa (`ExamPrepItemStatus`, `NotificationType`) — o enum é
espelhado em `packages/shared/src/enums.ts` como `APP_MODULES` (array
`as const`), a mesma dupla representação que `ExamPrepItemStatus` já tem.
Adicionar um módulo novo no futuro custa uma migration aditiva pequena — o
mesmo custo que qualquer outro enum do projeto já paga, e este projeto já
mostrou nesta mesma sessão (Plano de Estudos) que isso é rotina, não risco.

**Integrações fica de fora do enum.** Por decisão (#2 abaixo), deixa de ser
um módulo com item de Sidebar próprio — vira uma seção dentro de
Configurações, sempre acessível, sem toggle. O botão "Desconectar Google" que
já existe em `/integracoes` continua existindo, só muda de endereço.

### Metadados: o que fica em `packages/shared` vs. só no frontend

| Dado | Onde mora | Por quê |
| --- | --- | --- |
| `AppModule` (chaves) | `packages/shared` (Prisma enum + array espelhado) | Backend precisa validar e persistir |
| `MODULE_DEFAULT_ENABLED: Record<AppModule, boolean>` | `packages/shared` | Backend usa pra responder `GET /module-settings` sem linha no banco |
| `MODULE_DEPENDENCIES: Record<AppModule, AppModule[]>` | `packages/shared` | Backend valida ativar/desativar; frontend usa a mesma fonte pra mostrar o aviso |
| Rótulo, descrição, ícone (lucide) | **Só `apps/web/lib/modules.ts`** (novo arquivo, mesmo padrão de `navigation.ts`) | Backend nunca precisa renderizar texto ou ícone — mesma separação que já existe entre `NAV_SECTIONS` (só frontend) e as rotas (`*.routes.ts`, só backend) |

### Catálogo de módulos configuráveis

| Chave (`AppModule`) | Rótulo | Rota | Depende de | Item próprio na Sidebar | Padrão |
| --- | --- | --- | --- | --- | --- |
| `SUBJECTS` | Disciplinas | `/disciplinas` | — | Sim | Ativado |
| `ASSIGNMENTS` | Atividades | `/atividades` | — | Sim | Ativado |
| `EXAMS` | Provas | `/provas` | — | Sim | Ativado |
| `CALENDAR` | Calendário | `/calendario` | — | Sim | Ativado |
| `GRADES` | Notas | `/notas` | Disciplinas | Sim | Ativado |
| `HISTORY` | Histórico | `/historico` | Notas | Sim | Ativado |
| `MATERIALS` | Materiais | `/materiais` | — | Sim | Ativado |
| `STUDY_PLAN` | Cronograma | `/cronograma` | — | Sim | Ativado |
| `STATISTICS` | Estatísticas | `/estatisticas` | — | Sim | Ativado |
| `CLASSES` | Turmas | `/turmas` | Disciplinas, Atividades, Provas, Calendário | Sim | Ativado |
| `EXAM_PREP` | Plano de Estudos | `/plano-de-estudos/:id` | Provas | **Não** (contextual, a partir de uma prova) | Ativado |
| `FLASHCARDS` | Flashcards | `/flashcards` | — | **Não** (decisão anterior, redesenho pendente) | **Desativado** |

`FLASHCARDS` é a única exceção ao "tudo ativado" — porque "tudo ativado"
significa preservar a experiência **atual**, e Flashcards já está fora da
navegação por uma decisão anterior deste mesmo projeto (visual pendente de
redesenho). Ligar o padrão dele agora reintroduziria, sem pedido, algo que já
tinha sido tirado de propósito. O toggle existe e funciona — quem quiser
Flashcards de volta ativa manualmente em Configurações.

**Estruturais (nunca aparecem na lista de módulos, sempre acessíveis):**
Dashboard, Configurações (com Integrações dentro), Autenticação, Busca
global (chrome sempre visível, conteúdo filtrado — ver adiante), Central de
notificações (idem), menu de usuário/conta.

### Regra de dependência: ativar propaga, desativar bloqueia

Assimétrico de propósito:

- **Ativar** um módulo com dependência desligada **ativa a dependência
  junto**, com um aviso (`"Provas foi ativado porque Plano de Estudos depende
  dele"`) — decisão #3. É uma cascata "pra cima", sempre aditiva, nunca some
  nada da tela de quem já estava usando.
- **Desativar** um módulo que outro módulo ativo depende dele **bloqueia**,
  com a mensagem exata do exemplo do pedido original: `"Turmas utiliza
  Disciplinas. Para desativar Disciplinas, primeiro desative Turmas."` Uma
  cascata "pra baixo" automática desligaria módulos que o usuário nunca pediu
  pra desligar — daí o bloqueio em vez da propagação.

### Backend: dois endpoints

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/module-settings` | — | `{ module, enabled }[]` — os 12 módulos, mesclando linhas do banco com o padrão |
| PATCH | `/module-settings/:module` | `{ enabled: boolean }` | Ativando: `{ updated: [...], autoEnabled: AppModule[] }`. Desativando com dependente ativo: `409 { blockedBy: AppModule[] }` |

Nenhuma dessas chamadas mexe em dado de nenhum outro módulo — só na tabela
`UserModuleSetting`.

### Frontend: um hook central, não `if` espalhado

```
GET /module-settings (React Query, staleTime alto — muda raramente)
        ↓
useModuleSettings() / useIsModuleEnabled(module)
        ↓
   ┌────────────┬───────────┬────────┬───────────────┬──────────────┐
Sidebar     Dashboard   Guarda de   Busca global   Notificações
(filtra    (esconde     rota       (backend        (backend
NAV_       cards/stats  (redireciona filtra,        filtra por
SECTIONS)  por módulo)  se desativado) não frontend)  tipo↔módulo)
```

A guarda de rota fica **num só lugar** — `apps/web/app/(app)/layout.tsx`,
ao lado do `AuthGuard` que já existe ali — usando o mesmo mapa rota→módulo
que `navigation.ts` (via `findNavItem`) já mantém pra Sidebar e pros
breadcrumbs, só estendido com o campo `module` opcional em cada item. Isso
evita exatamente o "`if moduleEnabled` em dezenas de componentes" que o
pedido original queria evitar (§21) — um item sem `module` (Dashboard,
Configurações) nunca é bloqueado.

Acesso direto a uma rota desativada (§22): redireciona para `/dashboard` com
um toast — `"Notas está desativado. Ative em Configurações para acessar."` —
nunca um 404 (o dado não deixou de existir, só está fora da experiência).

### Busca global: filtro no servidor, não no cliente

A federação em `search.repository.ts` já roda 5 queries em paralelo — a
mudança é o backend, sabendo os módulos ativados do próprio usuário
autenticado, **pular a query inteira** de uma tabela cujo módulo está
desativado (nunca falar em `Promise.all` condicional confiando em uma flag
vinda do cliente). Mais seguro (não depende do cliente mandar o filtro certo)
e mais barato (nem consulta o banco pra um resultado que não vai aparecer).

### Notificações: filtro de leitura, nunca exclusão

`generatePending()` para de **gerar** notificação nova de um tipo cujo módulo
está desativado (ex.: `CLASS_ANNOUNCEMENT` some da geração se `CLASSES`
estiver desativado). `list()`/`unreadCount()` filtram (`WHERE type NOT IN
(...)`) as notificações já existentes desses tipos — sem apagar linha
nenhuma. Reativar o módulo faz as notificações voltarem a aparecer, porque é
só um filtro de leitura, não um estado gravado na notificação. `SYSTEM` nunca
é filtrado — é estrutural.

## Dashboard: o que se esconde, o que fica

| Seção | Depende de | Comportamento quando o módulo está desativado |
| --- | --- | --- |
| `StatCard` "Em aberto"/"Atrasadas" | Atividades | Some; grid de stats recalcula colunas |
| `StatCard` "Provas próximas"/"Próxima prova" | Provas | Idem |
| Card "Próximas atividades" | Atividades | Some do grid de 3 colunas |
| Card "Próximas provas" | Provas | Idem |
| Card "Calendário" (mini-calendário) | Calendário | Idem |
| Card "Atividades atrasadas" | Atividades | Some (full-width) |
| `Greeting` (saudação, contagem "essa semana") | — | Fica, mas some a parte da frase que citaria um módulo desativado |

Se o grid de 3 colunas ficar com 1 ou 2 cards em vez de 3, ele reflui (não
deixa buraco vazio). No caso extremo de o usuário desativar Atividades,
Provas e Calendário ao mesmo tempo, o Dashboard vira só a saudação + um
convite pra Configurações — aceitável, é exatamente o que o usuário pediu.

Não incluído no MVP: esconder gráfico *dentro* de Estatísticas por módulo
individual desativado (ex.: some só o gráfico de provas, mantém o resto).
Fica só o toggle inteiro de Estatísticas por ora — granularidade por
gráfico é refinamento futuro, listado nas sugestões.

## Possíveis simplificações

Nenhuma destas está decidida — cada uma é uma proposta para revisão, no
formato pedido.

| # | Elemento | Onde aparece | Por que pode sair | Onde continua acessível | Impacto | Recomendação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Botão "Atualizar" manual | `Greeting`, Dashboard | O React Query já refaz a consulta ao focar a janela e a cada abertura; um botão de refresh manual é raro de precisar | Nenhum lugar — a atualização automática substitui | Baixo (poucos usuários clicam) | OPCIONAL — só remover se o comportamento automático for confirmado suficiente em teste real |
| 2 | Seção "Sistema" da Sidebar | `navigation.ts` | Fica vazia assim que Integrações dobra pra dentro de Configurações (Decisão #2) — não é mais sugestão, é consequência direta | — | — | Tratado na Etapa 29.6, não é opcional |
| 3 | Cabeçalhos de seção da Sidebar quando sobra pouco item ativo | `sidebar-nav.tsx` | Um usuário que desativou metade dos módulos pode ficar com uma seção "Acompanhamento" ou "Estudos" mostrando 1 item só embaixo de um título — parece mais poluição do que organização | A agrupação lógica não se perde, só o rótulo do grupo | Médio (cosmético, mas visível todo dia) | IMPORTANTE — decidir um limiar (ex.: esconder o título do grupo se ele tiver 1 item só) na própria Etapa 29.6 |
| 4 | Breadcrumb "Início > Página" | `breadcrumbs.tsx`, topo de toda página | Nunca tem mais de 1 nível hoje (nenhuma rota é aninhada visualmente) — o H1 da própria página já diz a mesma coisa | Nada se perde — a página continua com título | Baixo | OPCIONAL — fora do escopo deste plano, mencionado só como observação |

## Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Padrão dos módulos ao lançar | **Tudo ativado pra todo mundo** (existentes e novos), com a única exceção documentada de `FLASHCARDS` (permanece desativado por padrão, preservando a decisão anterior de tirá-lo da navegação) |
| 2 | Integrações | **Dobra pra dentro de Configurações.** Deixa de ser módulo com item de Sidebar; vira seção sempre acessível dentro de Configurações, junto com "Sincronizar" |
| 3 | Ativar módulo com dependência desligada | **Ativa a dependência junto**, avisando o motivo |

## Onboarding / primeiro acesso

Como o padrão já é "tudo ativado", **não entra tela de personalização no
primeiro acesso** nesta rodada — não há nada de diferente pra perguntar logo
de cara, e uma tela extra no cadastro é mais atrito sem benefício claro. A
personalização acontece onde ela é permanente e revisitável: Configurações →
Módulos. Fica anotado como melhoria futura opcional (uma tela leve de
boas-vindas mostrando onde encontrar Configurações), não parte do MVP.

## Integridade de dados com módulo desativado

Confirmado pela análise do schema: nenhuma tabela tem uma constraint que
dependa de um módulo estar "ativo" (isso nem é um conceito que existe no
banco hoje) — `enabled`/`disabled` é uma leitura da camada de API e UI, nunca
do Prisma. Consequência prática: sincronizar o Google Classroom com
Atividades desativado continua criando `Assignment`s normalmente (a
sincronização não checa módulo, só grava); a notificação de
`ASSIGNMENT_CREATED` é que fica filtrada na leitura (regra acima). Criar uma
Nota com o módulo Notas desativado por outro caminho (ex.: uma prova
recebendo `Grade` automaticamente) também funciona sem erro — o dado só
não aparece na experiência principal até o módulo ser reativado.

## Plano por etapas

Numeração seguindo o roadmap atual (o item 28 é o PWA).

### Etapa 29.1 — Modelagem: enum, tabela e pacote compartilhado

**Objetivo.** Criar a base de dados e os contratos compartilhados, sem
nenhuma tela ainda. **Banco.** `enum AppModule` + `model
UserModuleSetting` (`schema.prisma`), migration aditiva (sem dado a
migrar — tabela nasce vazia). **Backend.** Nenhuma rota ainda.
**Shared.** `APP_MODULES`, `AppModule`, `MODULE_DEFAULT_ENABLED`,
`MODULE_DEPENDENCIES` em `packages/shared/src/enums.ts` (ou arquivo novo
`module.ts`); schema Zod `updateModuleSettingSchema`. **Riscos.** Nenhum —
puramente aditivo. **Testes.** `npx prisma generate` sem erro;
`npm run typecheck` no shared. **Aceite.** Tabela existe no banco, tipos
exportados do `@painel/shared`.

### Etapa 29.2 — Backend: endpoints de módulo + validação de dependência

**Objetivo.** `GET /module-settings` e `PATCH /module-settings/:module`
funcionando ponta a ponta, com a regra de ativar-propaga/desativar-bloqueia.
**Banco.** Usa a tabela da 29.1. **Backend.** `module-settings.repository.ts`
(merge padrão+linhas), `module-settings.service.ts` (lógica de dependência),
`module-settings.controller.ts`/`.routes.ts`, registrado em
`routes/index.ts`. **Frontend.** Nenhum ainda. **Riscos.** Bug na lógica de
dependência deixar dois módulos "presos" um no outro por engano — mitigar
com teste de cada par de dependência do catálogo. **Testes.** Script
`scratch-qa` (sem mock, servidor local): ativar/desativar cada módulo,
tentar desativar `SUBJECTS` com `CLASSES` ativo (espera 409), ativar
`EXAM_PREP` com `EXAMS` desligado (espera `autoEnabled: ['EXAMS']`).
**Aceite.** Os 12 módulos respondem certo nos três cenários (ativar simples,
ativar com propagação, desativar bloqueado).

### Etapa 29.3 — Frontend: hook central + registro de módulos

**Objetivo.** `useModuleSettings()`/`useIsModuleEnabled()` (React Query) e
`apps/web/lib/modules.ts` (rótulo, descrição, ícone, `hasOwnSidebarEntry`
por módulo) — a peça que todo o resto (29.4 em diante) vai consumir.
**Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** `hooks/use-module-
settings.ts`, `services/module-settings.service.ts`, `lib/modules.ts`.
**Riscos.** Nenhum (nada consome ainda). **Testes.** Unitário/manual do
hook contra a API da 29.2. **Aceite.** `useIsModuleEnabled('GRADES')`
retorna o valor certo depois de um toggle.

### Etapa 29.4 — Página de Configurações → Módulos

**Objetivo.** Primeira tela de Configurações do projeto (`/configuracoes`),
com a lista dos 12 módulos, toggle, descrição, e o aviso permanente
"desativar não apaga dados". **Banco.** Nenhuma. **Backend.** Nenhum (usa
29.2). **Frontend.** `app/(app)/configuracoes/page.tsx`, componente de linha
de módulo (ícone, nome, descrição, `Switch`), toast de dependência
auto-ativada, diálogo/mensagem de bloqueio ao tentar desativar com
dependente ativo. **Riscos.** UX confusa se o aviso de dependência não for
claro — testar a mensagem com os quatro pares de dependência do catálogo.
**Testes.** Cada módulo liga/desliga e reflete na lista imediatamente;
tentar desativar `EXAMS` com `EXAM_PREP` ativo mostra a mensagem certa.
**Aceite.** Os 12 toggles funcionam, nenhum apaga dado (conferir que a linha
em `Assignment`/`Grade`/etc. continua no banco depois de desativar).

### Etapa 29.5 — Configurações → Integrações

**Objetivo.** Mover o conteúdo de `/integracoes` (status da conexão Google,
"Desconectar", e o botão "Sincronizar" que sai do Dashboard) pra dentro de
Configurações, como uma segunda seção/aba. **Banco.** Nenhuma. **Backend.**
Nenhum — `integration.routes.ts` não muda, só quem chama. **Frontend.**
Conteúdo de `app/(app)/integracoes/page.tsx` migra pra
`app/(app)/configuracoes/page.tsx` (aba "Integrações"); a rota
`/integracoes` é removida (ou vira redirect pra `/configuracoes`); o botão
"Sincronizar" sai de `app-shell.tsx`. **Riscos.** Alguém com a URL antiga
salva (favorito) — mitigar com redirect em vez de 404. **Testes.** Sincronizar
Classroom a partir da nova localização; conferir que nenhum link interno
antigo aponta mais pra `/integracoes`. **Aceite.** Sincronização funciona
de dentro de Configurações; Dashboard e Navbar não têm mais botão de sync.

### Etapa 29.6 — Sidebar dinâmica

**Objetivo.** `NAV_SECTIONS` filtrado pelos módulos ativos; seção "Sistema"
some (ficou vazia com a 29.5); seções com 1 item só perdem o cabeçalho de
grupo (simplificação #3); card de usuário sai da Sidebar. **Banco.**
Nenhuma. **Backend.** Nenhum. **Frontend.** `navigation.ts` ganha campo
`module?: AppModule` opcional por item; `sidebar-nav.tsx` filtra antes de
renderizar e esconde título de seção com &lt;2 itens visíveis; remoção do
bloco de usuário (já coberto pelo `UserMenu` na Navbar, sem perda de
funcionalidade). **Riscos.** Sidebar vazia se, num teste, todos os módulos
forem desativados — garantir que "Dashboard" e "Configurações" nunca somem
(são estruturais, sem `module`). **Testes.** Desativar cada módulo um a um e
conferir que só o item certo some; desativar todos os módulos de uma seção
e conferir que o cabeçalho some junto. **Aceite.** Sidebar reflete
exatamente os módulos ativos, sempre com Dashboard e Configurações
presentes.

### Etapa 29.7 — Guarda de rota

**Objetivo.** Acesso direto a uma rota de módulo desativado redireciona pra
`/dashboard` com toast explicativo, em vez de renderizar a página ou dar
404. **Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** Componente
`ModuleRouteGuard` em `app/(app)/layout.tsx` (ao lado do `AuthGuard`),
usando o mesmo mapa rota→módulo da 29.6. **Riscos.** Falso positivo
bloqueando uma rota estrutural — testar as 12 rotas de módulo mais
Dashboard/Configurações. **Testes.** Desativar `GRADES`, acessar `/notas`
direto pela URL — espera redirect + toast; reativar, acessar de novo —
espera a página normal. **Aceite.** Nenhuma rota estrutural é bloqueada;
toda rota de módulo desativado redireciona com mensagem clara.

### Etapa 29.8 — Integração com Busca Global

**Objetivo.** `GET /search` para de consultar (não só de mostrar) tabelas
de módulos desativados do usuário autenticado. **Banco.** Nenhuma.
**Backend.** `search.service.ts` consulta `module-settings.service.ts` antes
de montar o `Promise.all`, pulando a query de `Subject`/`Assignment`/
`Exam`/`CalendarEvent`/`Attachment` conforme o módulo correspondente
(`SUBJECTS`/`ASSIGNMENTS`/`EXAMS`/`CALENDAR`/`MATERIALS`) esteja desativado.
**Frontend.** Nenhuma mudança — o `CommandPalette` já só mostra o que vier
na resposta. **Riscos.** Nenhum — é uma redução de trabalho, não uma
mudança de contrato. **Testes.** Desativar `EXAMS`, buscar o nome de uma
prova existente — não aparece; reativar — volta a aparecer. **Aceite.**
Resultado de busca nunca inclui um tipo de módulo desativado.

### Etapa 29.9 — Integração com Notificações

**Objetivo.** `generatePending()` para de gerar tipo de notificação de
módulo desativado; `list()`/`unreadCount()` filtram os tipos desativados
sem apagar nada. **Banco.** Nenhuma. **Backend.** Mapa
`NOTIFICATION_TYPE_TO_MODULE` (`notification-rules.ts` ou novo arquivo),
usado nos três pontos citados. **Frontend.** Nenhuma mudança — o
`NotificationBell` já só mostra o que vier. **Riscos.** Confundir "filtrar
na leitura" com "não gerar" — os dois precisam acontecer juntos, senão uma
notificação nasce e fica invisível mas ainda soma no contador. **Testes.**
Desativar `CLASSES`, publicar um aviso de turma em outra conta de teste —
notificação não aparece nem soma no contador do usuário que desativou;
reativar — aparece (a notificação nunca foi apagada, só filtrada).
**Aceite.** Contador de não-lidas nunca inclui tipo de módulo desativado;
histórico permanece intacto no banco.

### Etapa 29.10 — Simplificação do Dashboard

**Objetivo.** Executar as três remoções já aprovadas (Sincronizar — feito na
29.5; Nova atividade; card de usuário — feito na 29.6) e aplicar a tabela
"Dashboard: o que se esconde, o que fica". **Banco.** Nenhuma. **Backend.**
Nenhum. **Frontend.** Remoção do botão "Nova atividade" de `Greeting`
(o fluxo de criação continua em `/atividades`, confirmado que já existe);
condicionais de módulo em cada card/stat do Dashboard; grid recalcula
colunas conforme quantos cards estão visíveis. **Riscos.** Grid quebrado
visualmente em combinações incomuns (ex.: só 1 dos 3 cards do meio visível)
— testar as combinações de 0, 1, 2 e 3 módulos ativos nessa linha.
**Testes.** Desativar Atividades — stats e cards relacionados somem, grid
não deixa buraco; desativar tudo relacionado ao Dashboard — sobra saudação +
CTA pra Configurações. **Aceite.** Dashboard nunca mostra card de dado de
módulo desativado; nunca fica com espaço em branco no lugar de um card
escondido.

### Etapa 29.11 — Outras simplificações aprovadas

**Objetivo.** Implementar o que for aprovado da tabela "Possíveis
simplificações" (#1 e #4 — #2 e #3 já são parte das etapas 29.5/29.6).
**Banco/Backend/Frontend.** Dependem do que for aprovado. **Riscos/Testes/
Aceite.** Definidos quando a aprovação vier — etapa fica em aberto até lá.

### Etapa 29.12 — Testes de regressão e documentação

**Objetivo.** Passada final de ponta a ponta e atualização da documentação.
**Banco.** Nenhuma. **Backend.** Nenhum. **Frontend.** Nenhum (só
correções que os testes apontarem). **Testes.** Matriz completa: cada um
dos 12 módulos, sozinho, ativado→desativado→reativado, conferindo Sidebar,
Dashboard, rota direta, busca e notificações nos três estados; os 3 pares
de dependência (Notas→Disciplinas, Histórico→Notas, Turmas→[4 módulos],
Plano de Estudos→Provas) nos dois sentidos (ativar propaga, desativar
bloqueia); usuário com **tudo desativado exceto o estrutural** não quebra
nenhuma tela. **Aceite.** Nenhuma regressão nos módulos já existentes;
documentação escrita.

## Documentação

Ao concluir, criar `docs/modules/modulos-configuraveis.md` (arquitetura do
`UserModuleSetting`, regra de dependência, mapa módulo↔rota↔notificação) e
`docs/modules/configuracoes.md` se a tela crescer o suficiente para merecer
página própria (senão, cobrir dentro do arquivo acima). Marcar a Etapa 29
como ✅ em `roadmap.md`. Atualizar `docs/architecture.md` (contagem de
entidades, hoje "20 entidades", passa a citar `UserModuleSetting`). Uma
linha nova em `README.md` na lista de funcionalidades.

## Perguntas em aberto

Nenhuma bloqueia o início — as três decisões que importavam pro desenho já
foram respondidas. Só um ponto fica para revisão na Etapa 29.11:

1. Das duas simplificações "opcionais" da tabela (#1 botão Atualizar, #4
   breadcrumb de 1 nível), quais entram nesta rodada e quais ficam de fora?
