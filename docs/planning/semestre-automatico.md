# Etapa 31 — Semestre automático ✅

> **Status: implementado.** As três sub-etapas abaixo estão concluídas — ver "Nota de
> implementação" em cada uma para os desvios do texto original.

## Problema

Hoje, cadastrar um `Semester` exige preencher 5 campos manualmente (Nome, Ano, Período/metade do ano, Data início, Data fim, Situação), e um usuário novo começa sem nenhum semestre até criar um na mão em Histórico. Levantamos o uso real de `Semester` no código inteiro e achamos dois fatos que mudam a conversa:

1. **`startDate`/`endDate` não têm nenhum efeito em nenhuma regra de negócio** — são gravados, devolvidos e validados (fim depois do início), mas nunca aparecem numa cláusula de filtro/consulta em lugar nenhum do backend. São puramente decorativos.
2. Toda a lógica que de fato *usa* um semestre (Disciplina, Notas, Estatísticas, propagação de modelo de notas, sincronização do Classroom, e o `Class.semesterId` da Etapa 30) só precisa de um **id válido** apontando pra um registro com `(ano, metade do ano)` corretos — nunca precisa que esse registro tenha sido criado manualmente.

Este documento propõe que `Semester` continue existindo como registro (Disciplina/Turma/Notas continuam apontando pra um id de verdade), mas **nasça sozinho**, sem formulário, calculado a partir da data de hoje - e que "semestre atual" deixe de ser uma escolha manual (checkbox) e passe a ser sempre o que bate com o calendário.

**Por que é uma etapa separada da 30, e não uma sub-etapa dela**: é mais fácil de isolar e desfazer se algo não funcionar como esperado. As duas são compatíveis - a Etapa 30 não depende de como um `Semester` nasce, só de que ele exista e tenha um id.

## Como fica "Finalizar/Encerrar semestre" — a pergunta central

Hoje, `semesterService.close` faz duas coisas ao mesmo tempo: (1) congela a nota final de cada disciplina do semestre e (2) desmarca `isCurrent`. Na prática, ele "fecha e sai" - mas nunca "abre o próximo": quem cria o semestre seguinte é sempre uma ação manual separada, em outro lugar.

Com `isCurrent` deixando de ser um campo gravado (vira sempre "o que bate com a data de hoje", calculado ao vivo), **a parte de "avançar pro próximo" desaparece por conta própria, sozinha, só pela passagem do calendário** - no dia em que a data virar, o próximo semestre já existe (ou é criado na hora que alguém precisar dele) e já É o atual, sem nenhum clique.

O que sobra pra "Encerrar" fazer é só a metade que sempre foi uma decisão humana, não uma data: **congelar a nota final**. Isso muda de "fechar isto e abrir o próximo" pra **"already estou noutro semestre; só preciso consolidar as notas do anterior quando eu quiser"** - pode acontecer semanas depois do calendário já ter virado, sem bloquear nada, exatamente como hoje já permite (nada força ninguém a fechar um semestre na data certa).

Efeito prático: é possível (e normal) um semestre estar **"Atual" e "Encerrado" ao mesmo tempo** por um tempo — alguém termina as disciplinas em junho, fecha as notas na hora, mas calendarmente ainda está dentro da janela de jan-jun até virar julho. As duas badges coexistem sem contradição; assim que a data vira, "Atual" muda sozinha pro próximo, "Encerrado" continua ali, agora corretamente descrevendo um semestre passado.

## Decisões propostas

| # | Pergunta | Proposta |
| --- | --- | --- |
| 1 | Onde o `Semester` "atual" nasce, na prática? | **No primeiro login**, junto do mesmo bootstrap que já cria o modelo de notas padrão do usuário (`GradeConfiguration.defaultForUserId`) — mesmo gatilho, mesmo padrão, sem inventar mecanismo novo. Como rede de segurança, qualquer leitura que precise do "semestre atual" resolve na hora (acha-ou-cria) se por algum motivo ele ainda não existir - mesmo princípio "sob demanda" que a central de notificações já usa hoje. |
| 2 | O que "Encerrar" passa a significar? | **Só congelar nota final.** Nunca mais "avança" pra outro semestre - isso passa a ser automático, só pela passagem do calendário (ver seção acima). |
| 3 | Dá pra fixar manualmente um "atual" diferente do calculado (ex.: alguém fora do ritmo padrão, trancou matrícula)? | **Não, nesta etapa.** Decisão consciente de simplificar ao máximo - o app é de uso pessoal/pequena escala, e esse caso de borda provavelmente não existe na prática hoje. Fica registrado como extensão futura, se algum dia fizer falta. |
| 4 | `SemesterStatus.PLANNED` continua existindo? | **Não.** Sem criação manual antecipada, não existe mais "semestre planejado que ainda não começou" - todo semestre já nasce em uso. Fica só `ACTIVE`/`FINISHED`. |
| 5 | Dá pra editar Nome/Ano/Metade do ano/Datas depois de criado? | **Nome sim** (edição leve, cosmética - alguém pode querer chamar de outra coisa). **Ano/metade do ano/datas não** - são a própria identidade do registro; mudar isso seria "virar outro semestre", não editar o atual. |
| 6 | Isso muda a mecânica de `Class.semesterId`/`ClassMember.semesterId` da Etapa 30? | **Não na mecânica, só na prática.** `resolveMemberSemester` continua existindo tal como projetado ali (acha-ou-cria por `(ano, metade do ano)`) - só que agora, na maioria das vezes, ele "acha" em vez de "cria", porque o semestre pessoal já existe de antemão. A Turma continua avançando por ação explícita do dono (Etapa 30.5), independente do calendário pessoal de cada membro - as duas coisas podem, temporariamente, apontar pra semestres diferentes do mesmo usuário (a turma "atrasada" em relação ao calendário pessoal dele), o que é esperado, não é bug: se resolve sozinho quando o dono finaliza o semestre da turma, ou quando o calendário pessoal alcança o da turma. |

## Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | Usuário confunde "Encerrar" com "avançar pro próximo" e espera que algo mude na tela | Copy clara no diálogo de confirmação: "Isso só congela suas notas - você já está automaticamente no semestre seguinte" |
| R2 | Bootstrap no primeiro login falha silenciosamente e o usuário fica sem semestre atual | Reaproveita o mesmo mecanismo já testado do bootstrap do modelo de notas padrão, em vez de inventar um novo caminho; resolução "sob demanda" (Decisão #1) cobre o caso de falha, criando na primeira leitura que precisar |
| R3 | Perda de flexibilidade pra quem está fora do calendário padrão (Decisão #3) | Nenhuma nesta etapa - decisão consciente. Documentar como extensão futura se necessário |
| R4 | Divergência temporária entre o semestre pessoal automático e o semestre que uma Turma específica está usando | Nenhuma ação corretiva necessária - estado esperado e temporário (Decisão #6), não é um bug a corrigir |

## Plano por etapas

### Etapa 31.1 — Banco: simplificar `Semester` ✅

**Objetivo.** Remover o que deixa de fazer sentido no schema: a flag `isCurrent` gravada e o status `PLANNED`.

**Banco.**
- `Semester`: remove a coluna `isCurrent` (substituída por cálculo ao vivo, nunca mais persistida).
- `SemesterStatus`: remove `PLANNED`, fica só `ACTIVE`/`FINISHED`.
- Nova função pura compartilhada (`packages/shared`, ou reaproveitada da Etapa 30.4 se ela já tiver sido feita): `getCurrentSemesterKey(now: Date): { year, term }` - mesma regra de corte já usada hoje (mês < junho → 1º semestre).
- Migração: sem necessidade de backfill complexo (plataforma ainda não está em uso). Se algum registro de teste tiver `isCurrent: true` num semestre que não bate com o cálculo de hoje, isso simplesmente deixa de ter efeito a partir da migração - não quebra nada, só passa a valer a regra nova.

**Aceite.** `isCurrent` não existe mais em nenhuma tabela nem tipo do código (`grep` limpo). `SemesterStatus` só aceita `ACTIVE`/`FINISHED`.

**Testes.** `getCurrentSemesterKey` testada por unidade nas mesmas bordas já usadas na Etapa 30.4 (31/12, 01/01, 30/06, 01/07), com mutação deliberada pra confirmar que o teste pega regressão.

> **Nota de implementação.** A função pura foi para `packages/shared/src/semester-period.ts`
> (`getCurrentSemesterKey`, `defaultSemesterName`, `defaultSemesterDates`, `isCurrentSemester`),
> não em `apps/api/src/utils` — é consumida pelo front (badge "Atual", pré-seleção de semestre) e
> pelo seed, não só pela API. A regra de corte estava **triplicada e divergente** antes desta
> etapa (seed, formulário manual removido, `class-subject-linking.service`); agora há uma fonte
> só. 10 testes por mutação em `semester-period.test.ts`. Migration nova
> (`20260816120000_semester_automatic`) faz o backfill de `PLANNED → ACTIVE` antes do swap do
> enum, depois remove `isCurrent` e seu índice — escrita à mão porque este ambiente não tem um
> Postgres acessível para `prisma migrate dev` gerar/validar; **rodar `npm run db:migrate` contra
> um banco real antes de confiar cegamente nela**.

---

### Etapa 31.2 — Backend: bootstrap automático + resolução sob demanda ✅

**Objetivo.** Todo usuário sempre tem um semestre atual válido, sem nunca precisar criar um manualmente.

**Backend.**
- No fluxo de primeiro login (mesmo gatilho que já cria o `GradeConfiguration` padrão do usuário), cria também o `Semester` atual, usando `getCurrentSemesterKey`.
- Novo `semesterService.getOrCreateCurrent(userId)`: acha o `Semester` de `(ano, metade do ano)` calculado agora; se não existir (ex.: conta antiga, ou o calendário virou depois do bootstrap), cria na hora - mesmo princípio "sob demanda" que a central de notificações já usa, sem precisar de cron nem worker.
- `dashboard.service`, `classroom-sync.service` e o default do formulário de Disciplina passam a chamar esse helper em vez de ler a flag `isCurrent` de antes.
- `semesterService.close`: a lógica de congelar nota **não muda**. Só o texto que descreve a ação muda (deixa de sugerir "avançar", ver seção "Como fica Finalizar/Encerrar" acima).

**Aceite.** Nenhuma chamada à API que dependa de "semestre atual" retorna vazio/nulo pra um usuário autenticado, em nenhuma circunstância.

**Testes.** Teste de integração: usuário novo (bootstrap cria o semestre no login), usuário antigo sem semestre nenhum ainda (resolução sob demanda cria na primeira leitura), usuário no meio de uma virada de calendário (o cálculo muda de `(2026,1)` pra `(2026,2)` no dia certo, sem intervenção).

> **Nota de implementação.** `POST /semesters` foi **removida** (não só deixada de fora do
> frontend) — decisão tomada com o usuário durante o planejamento desta execução: criação vira
> função interna (`semesterService.ensure(userId, key)`), sem superfície pública, coerente com
> "o semestre nasce sozinho". `semesterRepository.findCurrent`/`clearCurrentFlag` foram removidos
> (não só descontinuados). Furo pré-existente corrigido junto: `auth.service.register` (cadastro
> por e-mail/senha) nunca chamava `ensureUserDefault` — só o fluxo do Google bootstrapava. Os dois
> fluxos agora chamam o mesmo `bootstrapNewUser(userId)` (modelo de notas + semestre atual, mesmo
> `.catch` que não derruba o cadastro/login). `resolveMemberSemester` (Turmas,
> `class-subject-linking.service.ts`) passou a delegar para `semesterService.ensure` — mesma
> assinatura pública, sem quebrar nada que a Etapa 30 assume.

---

### Etapa 31.3 — Frontend: remove o formulário manual, ajusta Histórico e diálogo de encerrar ✅

**Objetivo.** Nenhuma tela pede pra preencher um semestre à mão nunca mais.

**Frontend.**
- `semester-form-dialog.tsx`: some o fluxo de criação (Nome/Ano/Metade do ano/Datas/Situação); mantém só uma edição leve do nome (Decisão #5), se optarmos por manter essa opção.
- Histórico: os cards continuam existindo; a badge "Atual" passa a vir calculada (API já devolve o `semesterId` atual resolvido, front só compara) em vez de lida de um campo do registro.
- `subject-form-dialog.tsx`: o dropdown de semestre já vem com o atual pré-selecionado (em vez de "Sem semestre"), resolvendo de quebra a confusão de dropdown vazio que já tinha sido apontada antes neste projeto de polimento.
- `close-semester-dialog.tsx`: copy nova, deixando claro que a ação é só sobre notas (Risco R1).

**Aceite.** Em nenhum lugar do app existe mais um botão "Criar semestre" ou um formulário pedindo essas 5 informações. Toda tela que hoje lê `isCurrent` continua funcionando, sem regressão visual.

**Testes.** Verificação manual: usuário novo cai direto num Histórico já com um semestre atual visível, sem passar por nenhum formulário; criar uma Disciplina já sugere o semestre certo de cara.

> **Nota de implementação.** A badge "Atual" e a pré-seleção de semestre em Disciplina não
> dependem de campo novo no contrato: o front chama `isCurrentSemester` (mesma função pura do
> shared) sobre a lista que já carrega — `SemesterListItem`/`HistorySemester` perderam `isCurrent`
> por completo, uma fonte de verdade só. `semester-form-dialog.tsx` virou edição de nome puro (um
> campo); `historico/page.tsx` perdeu o botão "Novo semestre" e o CTA "Criar semestre" do estado
> vazio (que na prática não ocorre mais, já que `list`/`getHistory` sempre garantem o semestre
> atual antes de responder). Verificação manual completa (usuário novo por Google/senha,
> Dashboard, sincronização do Classroom, criação de Turma) **não foi executada** neste ambiente —
> não há Postgres acessível para subir a API. Rodar o roteiro do "Verificação" antes de dar como
> validado ponta a ponta.

## Fora do escopo

- Qualquer coisa relacionada à Turma (`Class.semesterId`, período do curso, "Finalizar semestre" da turma) - fica inteiramente na Etapa 30, que não depende desta.
- Fixar manualmente um semestre "atual" diferente do calculado (Decisão #3).
- Mudar o que "Encerrar" congela ou como calcula a nota final - só o texto/semântica do que a ação representa muda, o cálculo é o mesmo de hoje.
