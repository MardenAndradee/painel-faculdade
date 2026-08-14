# Módulos Configuráveis

O aluno decide quais partes do Painel Faculdade aparecem na sua experiência principal — Sidebar, Dashboard, busca global e notificações. A regra que governa tudo: **desativar um módulo esconde, nunca apaga.** Nenhuma tabela, linha ou relação é tocada quando um módulo sai de cena; reativar traz tudo de volta exatamente como estava.

### Catálogo e a exceção de Flashcards

Doze módulos são configuráveis — `SUBJECTS`, `ASSIGNMENTS`, `EXAMS`, `CALENDAR`, `GRADES`, `HISTORY`, `MATERIALS`, `FLASHCARDS`, `STUDY_PLAN`, `EXAM_PREP`, `STATISTICS`, `CLASSES` — todos nascendo **ativados**, com uma única exceção: `FLASHCARDS` nasce **desativado**, preservando uma decisão anterior do projeto de tirá-lo da navegação enquanto o visual não é refeito. "Tudo ativado" significa preservar a experiência que já existia, não forçar de volta algo que já tinha sido tirado de propósito.

Dashboard, Configurações, Autenticação, Busca global e a central de Notificações são **estruturais** — nunca aparecem na lista de módulos, sempre acessíveis. Integrações também é estrutural: dobrou para dentro de Configurações (ver adiante), não é mais um módulo com toggle próprio.

### Banco: uma tabela esparsa, sem migração de backfill

```prisma
enum AppModule { SUBJECTS ASSIGNMENTS EXAMS CALENDAR GRADES HISTORY MATERIALS FLASHCARDS STUDY_PLAN EXAM_PREP STATISTICS CLASSES }

model UserModuleSetting {
  userId  String
  module  AppModule
  enabled Boolean
  @@unique([userId, module])
}
```

Uma linha só existe quando o usuário **desvia** do padrão (`MODULE_DEFAULT_ENABLED`, em `packages/shared`). Ausência de linha = padrão. Como o padrão de onze dos doze módulos já era "ativado" — o comportamento que todo usuário existente já tinha —, lançar esta etapa não exigiu nenhuma migração de backfill: ninguém precisou ganhar linhas escritas no banco para continuar vendo exatamente o que já via.

`AppModule` é um enum do Prisma, espelhado como `APP_MODULES` em `packages/shared/src/enums.ts` — mesma dupla representação que `ExamPrepItemStatus`/`NotificationType` já usam, em vez de uma string livre. Adicionar um módulo novo custa uma migration aditiva pequena, o mesmo custo que qualquer outro enum do projeto já paga.

### Dependências: ativar propaga, desativar bloqueia

`MODULE_DEPENDENCIES` (também em `packages/shared`) mapeia cada módulo às suas dependências diretas: `GRADES → SUBJECTS`, `HISTORY → GRADES`, `EXAM_PREP → EXAMS`, `CLASSES → [SUBJECTS, ASSIGNMENTS, EXAMS, CALENDAR]`.

A regra é assimétrica de propósito:

- **Ativar** um módulo com dependência desligada **ativa a dependência junto**, transitivamente, e informa o motivo (`autoEnabled` na resposta do `PATCH`). Uma cascata só "pra cima", sempre aditiva.
- **Desativar** um módulo do qual outro módulo **ativo** depende é **bloqueado** com `409` (`error.details.blockedBy`) — nunca desativa em cascata pra baixo, o que desligaria algo que o usuário não pediu.

### Backend: dois endpoints, filtro no servidor em tudo que consulta módulo

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/module-settings` | Os 12 módulos, mesclando linhas do banco com o padrão |
| PATCH | `/module-settings/:module` | `{ enabled }` → `{ updated, autoEnabled }`, ou `409` com `blockedBy` |

`moduleSettingsService.getEnabledSet(userId)` é o ponto único que outros serviços consultam:

- **Busca global** (`search.service.ts`) pula a query inteira de uma tabela cujo módulo está desativado, em vez de filtrar o resultado depois — mais barato, e não depende de o cliente mandar o filtro certo.
- **Notificações** (`notification.service.ts`) para de **gerar** notificação nova de um tipo cujo módulo está desativado (`NOTIFICATION_TYPE_MODULE`, em `notification-rules.ts`) e filtra as já existentes na **leitura** (`list`/`unreadCount`, via `WHERE type NOT IN (...)`) — nunca apaga uma notificação já criada. `SYNC_COMPLETED`, `SYNC_FAILED` e `SYSTEM` são estruturais, nunca filtrados.

### Frontend: um hook central, guarda de rota central

```
GET /module-settings (React Query, staleTime alto)
        ↓
useModuleSettings() / useIsModuleEnabled(module)
        ↓
Sidebar (filtra NAV_SECTIONS)   Dashboard (esconde cards/stats)
ModuleRouteGuard (redireciona)  Configurações → Módulos (toggle)
```

`apps/web/lib/modules.ts` guarda rótulo, descrição, ícone e rota de cada módulo — o backend nunca precisa dessas informações, só das chaves e das regras de dependência. `ModuleRouteGuard` (ao lado do `AuthGuard`, em `(app)/layout.tsx`) bloqueia acesso direto por URL a uma rota de módulo desativado, redirecionando para o Dashboard com um aviso — nunca um 404, porque o dado não deixou de existir.

A Sidebar filtra `NAV_SECTIONS` pelos módulos ativos e descarta a seção inteira só quando todos os seus itens saem — o título de uma seção com 1 item só continua aparecendo, senão o item restante fica "sem teto", parecendo fora de lugar (achado em teste real: desativar Histórico deixava Estatísticas penduradinho sob Geral, sem cabeçalho). `EXAM_PREP` e `FLASHCARDS` não têm item próprio na Sidebar — o primeiro é alcançado de dentro de uma prova, o segundo está fora da navegação por decisão anterior — mas ambos continuam cobertos pela guarda de rota, que consulta `MODULE_DEFINITIONS` diretamente em vez do mapa de navegação.

### Dashboard: nunca um buraco vazio

Cada seção do Dashboard é condicionada ao módulo dono do dado (`ASSIGNMENTS`, `EXAMS`, `CALENDAR`). Quando um módulo sai, o card correspondente some e a grade recalcula o número de colunas — nunca sobra um espaço em branco no lugar de um card escondido. No caso extremo de desativar os três módulos que alimentam o Dashboard, a tela mostra só a saudação e um convite para Configurações, em vez de ficar majoritariamente em branco.

Aproveitando a mesma etapa: o botão "Sincronizar" saiu da Navbar (mudou de endereço, ver abaixo) e o botão "Nova atividade" saiu do Dashboard — o fluxo de criação já existia, com o próprio botão, dentro de `/atividades`. O card de usuário também saiu da Sidebar: o `UserMenu` da Navbar já mostra nome, e-mail e o menu de sair, sem duplicar nada.

### Configurações: Integrações também mora lá

`/configuracoes` é a primeira tela de Configurações do projeto — estrutural, sempre acessível, com duas abas (`?tab=modulos|integracoes`):

- **Módulos** — os 12 toggles, com aviso permanente de que desativar não apaga dado, e mensagens específicas para dependência auto-ativada ou bloqueio.
- **Integrações** — conteúdo migrado de `/integracoes` (que agora só redireciona, preservando favoritos antigos): status de conexão com Google Classroom/Calendar, sincronizar, desconectar.

Integrações deixou de ser um módulo com item próprio na Sidebar — dobrou para dentro de Configurações junto do botão "Sincronizar", reduzindo mais um item da navegação principal.

### O que ainda não foi decidido

Duas simplificações cosméticas ficaram registradas como propostas, não decisões: o botão "Atualizar" manual no Dashboard (o React Query já revalida automaticamente) e o breadcrumb de um nível só ("Início > Página", quando o H1 da própria página já diz o mesmo). Nenhuma das duas foi implementada — aguardam revisão.
