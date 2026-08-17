# Turmas

> **Status: implementado**, salvo a Etapa 25 (envio de e-mail, ainda só planejada — ver a seção
> própria mais abaixo). A hierarquia de Semestre/Período descrita neste documento (`Class`
> referenciando um `Semester` de verdade, `period` 1-8, aba Histórico da turma, limite de uma
> turma ativa por usuário) foi adicionada depois, na Etapa 30 do roadmap global. A virada de
> ciclo, inicialmente uma ação manual do dono ("Finalizar semestre"), passou a ser automática na
> Etapa 32 — ver "Virada automática do ciclo" mais abaixo. O texto abaixo já descreve o estado
> atual, pós-Etapa 32; a numeração "Etapa 20-26" usada no restante deste documento é interna
> deste módulo, não a numeração do roadmap global.

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
User ──< ClassMember >── Class ──semesterId──> Semester (do DONO)
                           │        │
                           │        └── period (1-8, cumulativo no curso)
                           │
                           Class ──< ClassSubject (semesterId, period herdados, imutáveis)
                           │            │
                           │            └──< ClassSubjectLink >── Subject (do membro)
                           ├──< ClassInvite
                           ├──< ClassAnnouncement
                           ├──< ClassMaterial
                           └──< ClassPost (semesterId, period herdados, imutáveis)
                                    └──< ClassPostCopy >── Assignment/Exam/CalendarEvent
```

**Turma ↔ Semestre (Etapa 30).** `Class` referencia um `Semester` de verdade — sempre o
`Semester` PESSOAL do **dono** (`Class.semesterId`, FK `onDelete: Restrict`: um semestre "em uso"
por uma turma ativa não pode sumir por baixo dela). Cada membro continua guardando **o semestre
dele** em `ClassMember.semesterId` (isso não mudou desde a Etapa 20) — ao entrar ou ao criar a
turma, o sistema acha-ou-cria o `Semester` do usuário para aquele ano/período via
`semesterService.ensure` (chamado `.create` até a Etapa 31; o comportamento é o mesmo, só o nome
mudou porque a Etapa 31 tirou a criação manual de semestre do app inteiro).

`Class.period` é um contador **separado** de `Semester.term`: `term` é a metade do ano civil
(1 ou 2), `period` é o progresso cumulativo no curso (1º a 8º). Os dois avançam juntos, sempre
pelo delta certo (nunca por edição direta — `PATCH /classes/:id` aceita `period`, mas não
`semesterId`), via **virada automática** (Etapa 32, ver seção própria abaixo). Virar não apaga
nada: `ClassSubject`/`ClassPost` do ciclo que terminou mantêm o `semesterId`/`period` antigos (são
gravados no momento da criação e nunca mudam depois) e saem da aba principal da turma para a aba
**Histórico** (`GET /classes/:id/history`, aberta a qualquer membro ativo, não só o dono) — mesmo
espírito de "excluir disciplina arquiva por padrão": nada some, só muda de lugar. O ciclo novo
começa sem disciplinas nem publicações; não há cópia automática do anterior (decisão explícita).

### Virada automática do ciclo (Etapa 32)

Até a Etapa 30, a virada de ciclo era uma ação manual do dono ("Finalizar semestre",
`POST /classes/:id/finish-semester`) — sem nenhuma validação contra o calendário: o dono podia
finalizar em qualquer dia do ano, inclusive várias vezes seguidas, adiantando a turma inteira (e
o semestre pessoal de cada membro ativo) em relação ao calendário real, sem nenhum aviso. A Etapa
32 fecha essa brecha aplicando à Turma a mesma decisão que a Etapa 31 já tinha aplicado ao
semestre pessoal: a virada deixa de ser algo que alguém pode esquecer ou disparar fora de hora, e
passa a ser um fato do calendário.

`classService.ensureCurrentCycle(classId)` compara o `(year, term)` do semestre atual da turma
com `getCurrentSemesterKey(hoje)` (mesma função do semestre pessoal). Quando bate, não faz nada —
o caso comum, uma leitura barata. Quando a turma ficou pra trás, calcula `termsBetween` (pode ser
mais de um semestre, se a turma ficou parada vários períodos) e pula **direto** pro semestre
certo, somando o delta inteiro no `period` de uma vez — nunca gera ciclos intermediários
quase-vazios no Histórico.

É chamada em todo ponto de entrada que lê o estado da turma, não só a tela principal:

| Ponto | Por quê |
| --- | --- |
| `classGuard` (middleware) | Cobre toda rota `/classes/:id/...` numa linha só |
| `classMembershipService.join` | Entrada por convite é por token, não passa pelo `classGuard` |
| `classService.previewInvite` | A prévia do convite (antes de aceitar) precisa refletir o ciclo real |
| `classService.list` | Mostra o period/semestre certo mesmo sem visitar o detalhe (no máximo 1 turma por usuário) |

O efeito colateral (mover conteúdo pra Histórico) pode ser disparado pela leitura de **qualquer**
membro ativo agora, não só do dono — aceitável, porque deixou de ser uma decisão de alguém: é um
fato do calendário. **Corrida entre requisições simultâneas:** o `update` final é condicional
(`classRepository.advanceCycle`, um `updateMany` filtrado por `WHERE semesterId = <antigo>`) —
quem chegar primeiro avança; o segundo vê `count: 0`, não duplica.

Transparência sem ação manual (Etapa 32.3): a tela da turma mostra, só pro dono, um texto pequeno
e discreto ("Próxima virada automática: 01/07/2026 · 8º período" — `GET /classes/:id/next-cycle`)
para não parecer que "sumiu" o controle, mas sem nenhum botão ou convite pra interagir.

**Uma turma ativa por vez.** Desde a Etapa 30, um usuário (dono ou membro) só pode ter uma
participação `ACTIVE` em turmas não-arquivadas simultaneamente — `class.service.create` e
`class-membership.service.join` recusam com `409` caso contrário. Turma arquivada não conta pro
limite (`Class.archivedAt IS NOT NULL` libera); por depender de coluna de outra tabela, isso é
checagem de aplicação, não um índice único de banco (mesmo padrão do teto de 100 membros).

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

A lista de "próprias disciplinas" **exclui as que já estão vinculadas a
QUALQUER molde desta turma** (`ClassDetail.myLinkedSubjectIds`) — sem isso,
nada impedia escolher a mesma disciplina pessoal duas vezes e criar dois
moldes apontando pra ela. O backend também recusa (`409`) uma tentativa de
vincular por id uma disciplina já usada nesta turma, mesmo passando por fora
da interface.

**Outros quatro ajustes do mesmo lote (feedback de uso real):**
- **"Semestre", não "Período"** no formulário de criação da turma — o campo é
  1 ou 2 (metade do ano civil) e dirige a mesma lógica de datas do `Semester`
  pessoal (Etapa 18); "período" no vocabulário do curso é cumulativo
  (8º período = 4 anos), um conceito diferente. *Atualização Etapa 30:* o
  período do curso passou a ser rastreado de verdade, em `Class.period` — ver
  "Turma ↔ Semestre" acima. Continua sendo um campo próprio, não mais só
  expressável no nome livre da turma como este parágrafo dizia originalmente.
- **Atividade e prova da turma perderam o campo de hora**, ficando só data —
  alinhado com as telas pessoais equivalentes, que já eram só data; a
  inconsistência era exclusiva do fluxo de publicação da turma. Evento
  continua com data e hora (mesmo comportamento do Calendário pessoal).
- **Créditos saiu da criação/edição de `ClassSubject`** — o campo continua
  existindo no modelo (e ainda entra no cálculo de CR de quem já tinha
  preenchido), só não é mais pedido nesse formulário; quem quiser, edita
  depois na disciplina pessoal.
- **Duração e sala saíram do formulário de publicar prova na turma** — os
  campos continuam opcionais no schema (`durationMinutes`/`room`), só não
  são mais pedidos nessa tela; ficam `null` na prova publicada.

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

**O que é compartilhado de verdade** (sem cópia): avisos, materiais, membros
e convites. São superfícies novas, sem estado por usuário, e não conflitam
com nada.

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
| Publicar aviso | ✅ | — |
| **Publicar material** | ✅ | ✅ |
| Excluir material | qualquer | só o próprio |
| Arquivar/desarquivar a turma (ver Etapa 24 — substitui excluir) | ✅ | — |
| Transferir propriedade (Etapa 24) | ✅ | — |
| Ver "Próxima virada automática" (Etapa 32.3) | ✅ | — |
| Ver aba Histórico (Etapa 30) | ✅ | ✅ |
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
| Fixar aviso | **IMPORTANTE** | um booleano |
| Comentários em avisos | **FUTURO** | vira moderação, denúncia, notificação — projeto próprio |
| Feed | **FUTURO** | ou tabela de eventos, ou união cara de 5 tabelas; a Visão geral entrega 80% |
| Enquetes | **FUTURO** | valor real (marcar data de prova), mas é um módulo inteiro |
| Estatísticas da turma | **FUTURO, com ressalva** | ⚠️ média de turma **revela nota individual** em turma pequena; exige mínimo de amostra |
| MODERATOR | **FUTURO** | dobra a matriz de permissões sem demanda |
| Reações | **DESNECESSÁRIO** | ruído social num app de organização |
| Checklist / tarefas compartilhadas | **DESNECESSÁRIO** | é a atividade compartilhada com outro nome |

### Layout

Cinco abas, e não oito — mais uma sexta, **Histórico**, adicionada na Etapa 30 pra guardar os
ciclos que a virada automática (Etapa 32) já encerrou. "Turmas" entra na seção Geral da sidebar;
desde a Etapa 30.2, o link já leva direto pra visão geral da turma quando o usuário tem uma (no
máximo uma ativa por vez), sem passar pela listagem.

```
┌─────────────────────────────────────────────────────────┐
│  ▌ 7º Período — 2026.2          Sistemas de Informação  │
│    6 disciplinas · 24 membros              [Editar] [Convidar ▾] │
├───────────────────────────────────────────────────────────────────┤
│  Visão geral │ Mural │ Disciplinas │ Materiais │ Membros │ Histórico │
└───────────────────────────────────────────────────────────────────┘

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

**"Mural" hoje é só avisos.** Nasceu planejado para reunir avisos e
anotações (efêmero e duradouro, a mesma ideia em dois formatos), mas
anotações não chegou a ser usada e foi removida — ver a nota na Etapa 22
abaixo.

**Convidar** abre um popover com código, link e QR juntos: três formas do mesmo
convite, não três funcionalidades.

*Atualização Etapa 30:* o parágrafo original previa uma pessoa em várias turmas no mesmo
semestre ("7º Período" + "Grupo de TCC") como cenário normal, com filtro por turma nas listagens
de Atividades/Provas para acomodar isso. Isso não é mais possível — desde a Etapa 30, um usuário
tem no máximo **uma** turma ativa por vez (turma arquivada não conta). O filtro por turma nessas
listagens continua existindo na API (`?classId=`), mas o cenário que o motivou deixou de existir.

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

> **Nota de remoção (pós-Etapa 31).** Anotações (`ClassNote`) não chegou a
> ser usada na prática e foi removida por completo — modelo, rotas,
> serviço, tela. `ClassAnnouncement` (Avisos) não foi tocado; o Mural
> continua existindo, só que com uma seção a menos. Nenhum dado real
> existia na tabela no momento da remoção.

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
  publicação nova (post, aviso, material) via `assertNotArchived` nos
  services de publicação; leitura, download e sair continuam
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
| Várias turmas ativas ao mesmo tempo | **Não, desde a Etapa 30.** Revisto: no máximo uma participação `ACTIVE` em turma não-arquivada por usuário; o filtro `?classId=` continua na API, mas o cenário de múltiplas turmas simultâneas que o motivou não existe mais |
| E-mail | **Planejado** — Resend, síncrono, dígest diário de prazos via Vercel Cron (Etapa 25) |

