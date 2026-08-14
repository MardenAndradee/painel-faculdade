# Plano de Estudos (planejado)

> **Só análise e plano — nada foi implementado.** Nenhum arquivo de código foi
> alterado, nenhuma migração criada, nenhuma dependência instalada. Esta
> seção documenta a arquitetura, as regras de negócio e o plano por etapas
> para aprovação. As cinco perguntas em aberto já foram respondidas e viraram
> as Decisões #1 a #9 abaixo; a implementação começa na Etapa 2.

### Objetivo

A partir de uma prova, o aluno cria um **espaço de preparação** para ela —
não um módulo novo e isolado, mas um lugar que **reúne** o que o sistema já
tem (materiais, flashcards, cronograma, estatísticas) mais um punhado de
peças novas e pequenas (conteúdos, objetivos, anotações), tudo amarrado a
uma prova específica. `Prova → Plano de Estudos → Conteúdos, Anotações,
Materiais, Flashcards, Cronograma, Progresso`.

### O que a análise encontrou

| Onde | O que é hoje | Por que importa pro plano |
| --- | --- | --- |
| `Exam.content` | Campo de texto livre já existe ("Assuntos que caem na prova", até 2000 caracteres) | Dá pra reaproveitar como referência ao criar o plano — mas é texto solto, não uma lista estruturada (ver Decisão sobre auto-preenchimento) |
| `Exam` | Sem `semesterId` direto e sem conceito de arquivamento | O semestre vem por `Exam → Subject → Semester`; "arquivar prova" não existe hoje, então esse caso de exclusão do pedido original não se aplica |
| `Attachment` (Materiais) | Uma FK opcional por vínculo (`subjectId` **ou** `assignmentId` **ou** `examId`, nunca mais de um — regra aplicada no service, `resolveTarget`) | Não dá pra reaproveitar essa mesma FK pro plano: um material já vinculado à prova, ou solto, ou preso à disciplina, precisa continuar podendo ser **referenciado** pelo plano sem perder o vínculo que já tem. Isso pede uma tabela de associação nova, não mais uma coluna |
| `Deck` / `Flashcard` | `Deck.subjectId` é opcional (baralho pode ser geral); nenhuma FK para `Exam` hoje; **a aba Flashcards já foi tirada da navegação** ("visual atual não ficou bom, será refeita antes de voltar" — comentário no próprio código), mas as rotas continuam funcionando | O module já está "pausado" na prática — mover os flashcards pra dentro do plano é, em grande parte, o próprio "refazer" que o comentário já previa, não uma ruptura nova |
| `StudySession` / `StudyAvailability` ("Cronograma", nome interno `study-plan`) | Já existe um bloco de estudo com `scheduledStart/scheduledEnd`, `status` (`PLANNED`→`IN_PROGRESS`→`COMPLETED`/`SKIPPED`, **`IN_PROGRESS` existe mas nenhuma tela usa hoje**), `actualMinutes`, FKs opcionais pra `subject`/`assignment`/`exam` | É exatamente o modelo de "sessão de estudo" que o pedido descreve — não precisa de tabela nova, só de uma FK a mais e de uma tela de "começar sessão" que hoje não existe (só existe geração automática em lote) |
| `Estatísticas` | Já soma `StudySession.actualMinutes` por dia e por disciplina (`studyMinutesByDay`, `studyMinutesBySubject`) direto do banco, sem tabela de agregação própria | "Sessão de estudo alimenta estatística" já é verdade hoje, de graça, contanto que a sessão tenha `subjectId` — não precisa mexer no módulo de Estatísticas |
| `Note` / `NoteFolder` | Editor de texto rico (Tiptap) já existe e é usado em dois lugares — notas por disciplina (com pastas) e o Mural da turma (`ClassNote.content`, um blob JSON só, sem pastas) | Não precisa de editor novo nem de biblioteca nova. O padrão certo pro plano é o do Mural (um blob por lugar), não o de pastas — o plano não precisa de organização hierárquica de notas |
| Turmas / `ClassPostCopy` | Uma prova publicada numa turma já vira uma **cópia pessoal** de `Exam` por membro (fan-out da Etapa 21) — cada aluno tem sua própria linha na tabela `exams`, não uma linha compartilhada | A privacidade do plano (§21 do pedido) sai de graça: como cada aluno já tem seu próprio `Exam`, um plano preso a `examId` já nasce individual, sem precisar de nenhuma regra especial |
| Nomes internos | `study-plan.routes.ts`, `study-plan.service.ts`, `packages/shared/src/schemas/study-plan.ts`, rotas `/study-plan/*` e `/study-sessions/*` **já pertencem ao Cronograma** | O nome sugerido no pedido (`StudyPlan`) colide com isso — precisa de um nome interno diferente (rótulo em português continua livre) |

### Arquitetura: `ExamPrep` (rótulo "Plano de Estudos")

Mesma separação que o projeto já usa em outros dois lugares: o **rótulo em
português** que o aluno vê não precisa ser o **nome interno** do código.
"Cronograma" é `study-plan` por baixo; "Materiais" é `Attachment` por baixo.
Aqui, "Plano de Estudos" é `ExamPrep` por baixo — evita a colisão de nomes
com o Cronograma (rotas, arquivos e schema Zod de `study-plan.*` já
existem) sem inventar um rótulo estranho pro aluno.

```
Exam (1 por aluno, já isolado por turma via fan-out)
 │
 │ 1:1 — no máximo um plano por prova, por aluno (§19)
 ▼
ExamPrep
 ├── notes: Json          → anotações (Tiptap, um blob só, como o ClassNote)
 ├── items: ExamPrepItem[]   → conteúdos E objetivos (mesma tabela, kind diferencia)
 ├── materials: ExamPrepMaterial[]  → referências a Attachment já existentes
 ├── decks: Deck[]         → Deck ganha examPrepId opcional
 └── studySessions: StudySession[] → StudySession ganha examPrepId opcional
```

`ExamPrepItem` cobre **Conteúdos** e **Objetivos** com a mesma tabela — ver
a Decisão dedicada abaixo sobre por que a distinção conceitual do pedido
(§14) vale a pena manter, mas não vale duplicar a implementação.

### Modelagem (schema proposto — só documentado, não aplicado)

```prisma
enum ExamPrepItemKind {
  CONTENT    // "o que estudar"
  OBJECTIVE  // "o que quero conseguir fazer"
}

enum ExamPrepItemStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
}

/// O espaço de preparação de UM aluno para UMA prova (rótulo "Plano de Estudos").
/// Nome interno diferente de "study-plan" (já usado pelo Cronograma) de propósito.
model ExamPrep {
  id    String @id @default(cuid())
  /// Anotações da prova, um blob só — mesmo padrão do ClassNote, não do
  /// Note/NoteFolder (não precisa de pastas pra uma prova só).
  notes Json   @default("{\"type\":\"doc\",\"content\":[]}")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// Exam.userId já torna a prova exclusiva de um aluno (inclusive quando
  /// veio de uma turma, via fan-out) — @unique aqui já garante "no máximo
  /// um plano por prova, por aluno" sem precisar compor com userId.
  examId String @unique
  exam   Exam   @relation(fields: [examId], references: [id], onDelete: Cascade)

  items         ExamPrepItem[]
  materials     ExamPrepMaterial[]
  decks         Deck[]
  studySessions StudySession[]

  @@index([userId])
  @@map("exam_preps")
}

/// Conteúdos e objetivos do plano — mesma tabela, `kind` diferencia (Decisão abaixo).
model ExamPrepItem {
  id     String             @id @default(cuid())
  kind   ExamPrepItemKind
  title  String
  status ExamPrepItemStatus @default(NOT_STARTED)
  order  Int                @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  examPrepId String
  examPrep   ExamPrep @relation(fields: [examPrepId], references: [id], onDelete: Cascade)

  @@index([examPrepId, kind])
  @@map("exam_prep_items")
}

/// Referência a um material JÁ EXISTENTE (Attachment) — não duplica o arquivo,
/// não move o vínculo que ele já tem (disciplina/atividade/prova/solto).
model ExamPrepMaterial {
  id      String   @id @default(cuid())
  addedAt DateTime @default(now())

  examPrepId String
  examPrep   ExamPrep   @relation(fields: [examPrepId], references: [id], onDelete: Cascade)
  attachmentId String
  attachment   Attachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)

  @@unique([examPrepId, attachmentId])
  @@map("exam_prep_materials")
}
```

Colunas novas em modelos que já existem (aditivas, ambas opcionais — nada
que já existe hoje quebra):

```prisma
model Deck {
  // ...campos atuais...
  examPrepId String?
  examPrep   ExamPrep? @relation(fields: [examPrepId], references: [id], onDelete: Cascade)
}

model StudySession {
  // ...campos atuais...
  examPrepId String?
  examPrep   ExamPrep? @relation(fields: [examPrepId], references: [id], onDelete: SetNull)
}
```

Repare a assimetria proposital entre os dois `onDelete`: `Deck` usa
`Cascade` (um baralho criado dentro de um plano é dado exclusivo dele —
ver Decisão sobre exclusão), `StudySession` usa `SetNull` (uma sessão já
soma nas Estatísticas; apagar o plano não pode apagar retroativamente
minuto já contado — ver §20 e §24 do pedido original).

Nada dos nomes sugeridos no pedido (`StudyPlan`, `StudyPlanContent`,
`StudyPlanObjective`, `StudyPlanFlashcard`) foi mantido ao pé da letra:
`StudyPlan` colide com o Cronograma (explicado acima); `Content`/`Objective`
viraram uma tabela só com `kind` (menos tabela, mesma distinção pro
aluno); `StudyPlanFlashcard` não existe — o plano referencia `Deck`
diretamente por FK, sem uma tabela de vínculo extra, porque (diferente de
Materiais) um baralho criado dentro do plano pertence só a ele, não precisa
de relação N:N.

### Conteúdos e Objetivos

Cada `ExamPrepItem` tem um checklist com três estados (`NOT_STARTED`,
`IN_PROGRESS`, `DONE`) — os três bastam: "em andamento" cobre o que o
pedido chamava de estado intermediário, e um quarto estado (tipo
"revisado") só faria sentido se houvesse um conceito de repetição, que
não existe aqui (quem repete é o flashcard, não o item da lista).

```
Conteúdos                    Objetivos
☑ Modelo OSI                 ☑ Entender TCP
☑ TCP                        ☐ Saber diferenciar TCP e UDP
☐ UDP                        ☐ Resolver exercícios de IPv4
☐ IPv4
☐ Controle de congestionamento

3 de 5 concluídos            1 de 3 concluídos
████████████░░░░ 60%         ███░░░░░░░ 33%
```

Nenhuma extração automática de conteúdo a partir de `Exam.content` — o
pedido proíbe isso explicitamente (§4). O que o plano faz é mostrar
`Exam.content` como um **painel de referência, somente leitura**, ao lado
do checklist (ex.: "Conteúdo cadastrado na prova: ..."), e oferecer um
botão manual "Transformar em itens" que quebra o texto em linhas e propõe
como itens — o aluno revisa, edita e descarta o que não serve antes de
salvar. É uma ação que o aluno pede, não o sistema adivinhando.

### Anotações

Um editor por plano, reaproveitando o Tiptap que já existe (`components/notes/note-editor.tsx`)
— sem editor novo, sem biblioteca nova, sem colaboração (a mesma restrição que
o Mural da turma já segue: "Tiptap já existente, um autor"). Guardado como um
`Json` só em `ExamPrep.notes`, no padrão do `ClassNote`, não no padrão
`Note`/`NoteFolder` (que existe pra organizar muitas notas de uma disciplina
inteira em pastas — overkill pra anotação de uma prova só).

### Materiais

O módulo de Materiais **continua existindo exatamente como hoje** —
`Attachment` continua podendo se vincular a disciplina, atividade, prova ou
nada, e continua acessível fora de qualquer plano. Dentro do plano, a única
ação nova é "Adicionar material ao plano", que cria uma linha em
`ExamPrepMaterial` apontando pro `Attachment` escolhido — sem duplicar
arquivo, sem mover vínculo.

```
Plano N1 — Redes                    Attachment (já existe)
                                     ├── Apostila Redes.pdf   (solto)
Materiais vinculados:        ◄────  ├── Slides N1.pdf        (preso à prova)
📄 Apostila Redes.pdf               └── Lista de exercícios.pdf (presa à disciplina)
📄 Slides N1.pdf
📄 Lista de exercícios.pdf
```

Como `Attachment` já pode ter `examId` apontando pra ESSA prova (alguém já
anexou um PDF direto na prova, fora do plano), o formulário de criação do
plano sugere automaticamente esses materiais como "já vinculados à prova"
com um clique pra confirmar — o resto (materiais soltos, da disciplina, de
outras atividades) fica atrás de um seletor manual, no mesmo padrão do
"já tenho essa disciplina" que a tela de Turmas já usa.

### Flashcards

Os flashcards passam a viver dentro do plano: `Deck` ganha `examPrepId`
opcional. Um baralho criado a partir de um plano nasce com esse vínculo;
criar/editar/excluir/estudar continua sendo exatamente a `study-session.tsx`
que já existe — nenhuma peça de estudo (fila, SM-2, avaliação de 4 níveis)
muda, só o lugar de onde ela é aberta.

### Sessões de estudo

Reaproveita `StudySession` como está — sem tabela nova, sem "histórico de
sessões" como página própria (o pedido proíbe isso em §13). A novidade é
usar de verdade o estado `IN_PROGRESS`, que já existe no enum mas nenhuma
tela aciona hoje:

```
[ Começar sessão ]
  → cria StudySession { status: IN_PROGRESS, scheduledStart: agora,
                         examPrepId, subjectId (herdado da prova) }

Durante a sessão (cronômetro no cliente):
  Plano: N1 — Redes   Conteúdo: TCP   Tempo: 32:15

[ Finalizar ]
  → POST /study-sessions/:id/complete
  → actualMinutes = agora − scheduledStart (calculado no servidor,
     não confia só no cronômetro do cliente)
  → "Você estudou por 32 minutos."
```

Isso não cria um segundo motor de sessão — é a mesma máquina de estados que
o Cronograma já tem (`PLANNED → IN_PROGRESS → COMPLETED/SKIPPED`), só que
disparada por um botão de "agora", não por um agendamento futuro.

### Integração com o Cronograma

Nenhum sistema de agendamento novo (o pedido proíbe em §15). A tela
`/cronograma` passa a mostrar, em cada sessão que tiver `examPrepId`, um
selo com o nome do plano e um link de volta — mesma ideia do selo "Da
turma" que `ClassPost`/`Exam` já usam. O gerador automático
(`schedule-generator.ts`) continua funcionando do jeito que está: quando
gera uma sessão a partir de uma prova pendente, se essa prova já tiver um
`ExamPrep`, a sessão gerada sai com `examPrepId` preenchido de graça.

### Integração com Estatísticas

Nenhuma mudança no módulo de Estatísticas é necessária: como toda
`StudySession` de um plano herda o `subjectId` da prova, ela já entra na
soma existente (`studyMinutesByDay`, `studyMinutesBySubject`,
`highlights.studiedMinutes`) sem tocar em `statistics.service.ts`. O
"tempo estudado" que aparece **dentro do dashboard do próprio plano** é
outra conta, menor: a soma de `actualMinutes` só das sessões daquele
`examPrepId`, calculada na hora, sem virar um novo gráfico na tela de
Estatísticas geral (o pedido proíbe criar uma tela nova de estatísticas em
§24).

### Progresso do plano

Sem indicador subjetivo de "preparação" (proibido em §12) — mas o mockup
do pedido (§17) mostra uma barra única, o que parece contradizer isso à
primeira vista. A saída: a barra existe, mas mede só **conclusão
objetiva de checklist**, e diz isso no rótulo — não finge medir quão
pronto o aluno está.

```
Itens concluídos                    (não "Preparação")
█████████████░░░ 65%   ← (conteúdos concluídos + objetivos concluídos) ÷ (total de itens)

Conteúdos       4/6
Objetivos       3/4
Flashcards      20 estudados     ← fora da barra: não tem "100%" natural
Tempo estudado  2h30             ← fora da barra: idem
```

Flashcards e tempo estudado ficam **fora** da barra de propósito — não têm
um teto natural de "concluído" (sempre dá pra estudar mais um card, mais um
minuto), então forçá-los numa porcentagem geraria o número artificial que
o pedido já rejeitou. Eles aparecem como números crus, ao lado.

### Dashboard do plano

Uma página própria, `/plano-de-estudos/[examPrepId]` (rótulo "Plano de
Estudos"; rota não colide com `/cronograma`), seguindo a mesma composição
de card-por-seção que `/cronograma` e a tela de disciplina já usam —
cabeçalho com nome da prova/data/disciplina, a barra de progresso, e uma
seção por peça (Conteúdos, Objetivos, Anotações, Flashcards, Materiais,
sessões recentes do Cronograma). O mockup do pedido é um bom ponto de
partida visual; o layout definitivo fica pra Etapa 4/12, com o design
existente do Painel Faculdade como referência (mesmos tokens de cor, cards
com borda, sem framework de UI novo).

### Criação do plano

Herdado automaticamente da prova, sem o aluno digitar de novo: título
("Plano de Estudos — <título da prova>"), disciplina, data da prova,
semestre (via `Exam → Subject → Semester`) e o conteúdo cadastrado na
prova (como painel de referência, não como itens prontos — ver "Conteúdos
e Objetivos" acima). Nenhum desses campos é **copiado** para dentro de
`ExamPrep` — o plano só guarda `examId` e lê o resto sempre pela relação,
ao vivo. Isso responde de graça a duas perguntas do pedido (§20): mudar a
data da prova não deixa nada dessincronizado (não existe cópia pra
dessincronizar), e não existe "arquivar prova" hoje, então esse cenário
não se aplica.

### Um plano por prova

`ExamPrep.examId` é `@unique` — o banco impede um segundo plano pra mesma
prova (mesmo aluno, já que `Exam` é exclusivo dele). O menu da prova reflete
isso:

```
⋮
├── Editar
├── Criar plano de estudo      ← ExamPrep ainda não existe pra essa prova
└── Excluir
```
```
⋮
├── Editar
├── Ver plano de estudo        ← ExamPrep já existe
└── Excluir
```

`ExamListItem` ganha um campo (`examPrepId: string | null`) pra o menu
decidir qual dos dois mostrar sem uma chamada extra.

### Exclusão e integridade

| Evento | Efeito |
| --- | --- |
| Excluir a prova (`Exam`) | `ExamPrep` é excluído em cascata (assim como já acontece com `Attachment`/`StudySession` presos à prova hoje) |
| Excluir o plano (`ExamPrep`) | Excluído: seus `ExamPrepItem`, `ExamPrepMaterial` (só a referência — o `Attachment` original continua existindo), e os `Deck`/`Flashcard` criados dentro dele. **Preservado**: a prova, a disciplina, materiais originais, baralhos de outros planos, e o tempo já contado nas Estatísticas (`StudySession.examPrepId` vira `null`, a sessão em si não some) |
| Arquivar a prova | Não existe hoje (`Exam` não tem `archivedAt`) — fora de escopo, não é um caso real ainda |
| Alterar a data da prova | Nada a fazer — o plano não guarda cópia da data, lê direto de `Exam.date` |

Como excluir um plano apaga de verdade os flashcards criados nele, a tela
de exclusão mostra uma confirmação com o que vai junto ("Isso vai excluir
3 baralhos e 24 cartões criados neste plano") antes de confirmar — nunca
uma exclusão silenciosa de flashcards.

### Turmas

Uma prova publicada numa turma já vira, para cada aluno, uma cópia pessoal
de `Exam` (fan-out da Etapa 21 — `ClassPostCopy.examId`, uma linha só desse
aluno). Um `ExamPrep` amarrado a essa cópia pessoal já nasce privado, sem
nenhuma regra nova: dois alunos da mesma turma, mesma prova publicada,
cada um cria (ou não) o seu próprio plano, sem ver anotações, flashcards,
objetivos ou progresso um do outro — porque tecnicamente são `Exam`s
diferentes, não porque o plano tem uma flag de privacidade.

### Migração dos flashcards existentes

Das quatro opções levantadas no pedido:

- **(A) Excluir os existentes** — descartado: o pedido proíbe perda de dado.
- **(B) Criar um plano especial pra eles** — descartado: exigiria um
  `ExamPrep` sem prova de verdade, o que contradiz a regra do próprio
  pedido de que todo plano nasce de uma prova (§3, "não quero inicialmente
  um plano genérico").
- **(D) Migrar pra um plano da disciplina** — descartado pelo mesmo motivo:
  disciplina não é prova.
- **(C) Deixar solto, sem plano** — **escolhida.** Tecnicamente já é o
  estado de hoje: `Deck.examPrepId` nasce `NULL` para todo baralho
  existente, nada muda pra eles. Continuam acessíveis pelas mesmas rotas
  de sempre (`/flashcards`, sem entrada na navegação — que já é o estado
  atual, não uma mudança).

Nenhuma migração de dado, nenhum backfill, nenhum baralho tocado. A ponte
pro novo mundo ("Vincular baralho existente", que deixaria o aluno adotar
um baralho solto dentro de um plano) **ficou fora do escopo desta versão**
por decisão explícita (Decisão #7) — os baralhos antigos permanecem
acessíveis e intactos, só não migram automaticamente. Enquanto isso, todo
baralho novo criado de dentro de um plano já nasce vinculado.

### Funcionalidades sugeridas

| Funcionalidade | Classificação |
| --- | --- |
| Sugerir automaticamente, na criação do plano, os materiais que já têm `examId` apontando pra essa prova | IMPORTANTE |
| "Vincular baralho existente" pra adotar um baralho solto dentro de um plano | FUTURO (tirado do escopo desta versão — Decisão #7) |
| Botão manual "Transformar conteúdo da prova em itens" (linha a linha) | IMPORTANTE |
| Selo no Cronograma linkando de volta pro plano quando a sessão tem `examPrepId` | IMPORTANTE |
| Notificação quando a prova está próxima e o plano tem 0% de itens concluídos (reaproveitando `NotificationType.EXAM_UPCOMING`, que já existe) | FUTURO |
| Pomodoro dentro da sessão de estudo | FUTURO (mencionado no pedido, fora do escopo atual) |
| Duplicar itens/objetivos de um plano pra outro da mesma disciplina | FUTURO |
| Indicador de "preparação" com IA ou heurística | NÃO RECOMENDADO — o pedido proíbe explicitamente (§12) |
| Banco de questões / exercícios manuais | NÃO RECOMENDADO — proibido em §10 |
| Simulados | NÃO RECOMENDADO — proibido em §11 |
| Compartilhar conteúdo/checklist do plano com colegas de turma | NÃO RECOMENDADO — contradiz a privacidade exigida em §21 |

### Fluxo completo

```
Prova
 ↓ menu ⋮ → "Criar plano de estudo"
Plano criado (título, disciplina, data e semestre já preenchidos)
 ↓
Conteúdo da prova aparece como referência — aluno decide se
"transforma em itens" ou digita os próprios
 ↓
Adicionar objetivos (opcional)
 ↓
Vincular materiais — os que já apontam pra essa prova aparecem
sugeridos; o resto é busca manual
 ↓
Criar ou vincular flashcards
 ↓
"Começar sessão" quando for estudar de fato
 ↓
Progresso (conteúdos/objetivos/flashcards/tempo) atualiza sozinho —
nada disso exige voltar e preencher de novo o que já foi informado
```

O ponto que mais evita retrabalho: nenhum dado da prova é redigitado (herdado
por relação, nunca copiado), e nenhuma peça (material, flashcard, sessão) é
reconstruída — todas são as mesmas telas/fluxos que já existem, só abertas a
partir de dentro do plano.

### Riscos

| # | Risco | Mitigação proposta |
| --- | --- | --- |
| R1 | Excluir um plano apaga flashcards de verdade, sem volta | Confirmação explícita listando o que será excluído antes de apagar |
| R2 | Confundir o `ExamPrep` novo com o `study-plan`/Cronograma existente (nomes parecidos) | Nome interno diferente (`ExamPrep`, rotas `/exam-preps`), rótulo em português já é distinto ("Plano de Estudos" vs. "Cronograma") |
| R3 | Baralhos soltos (migração C) ficarem "esquecidos" para sempre, sem ninguém adotar | Aceito conscientemente nesta versão (Decisão #7): eles continuam acessíveis e intactos pelas rotas atuais. Se virar incômodo real com o uso, "Vincular baralho existente" é a saída, e ela não exige mudança de modelagem — só uma tela |
| R4 | Página do plano virar uma tela poluída (7 seções empilhadas) | Seguir o mesmo padrão de card-por-seção que `/cronograma` já usa, com âncoras/rolagem, não abas escondendo dado |
| R5 | `Exam.content` mal-formatado (frases longas, sem quebra de linha) quebrar o "transformar em itens" | Ação é manual e o resultado é editável antes de salvar — pior caso é o aluno apagar/ajustar um item ruim, não perder dado |

### Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Conteúdos e Objetivos são tabelas separadas ou a mesma? | **A mesma** (`ExamPrepItem` + `kind`) — mantém a distinção conceitual que o aluno vê sem duplicar CRUD, formulário e barra de progresso |
| 2 | Quantos status por item? | **Três bastam** (`NOT_STARTED`/`IN_PROGRESS`/`DONE`) — um quarto só faria sentido com repetição, que já é papel do flashcard |
| 3 | Nome interno do novo módulo | **`ExamPrep`**, para não colidir com `study-plan`/`study-sessions` já usados pelo Cronograma. Rótulo visível continua "Plano de Estudos" |
| 4 | Barra de progresso única (mockup) vs. proibição de indicador subjetivo (§12) | **As duas coexistem**: a barra mede só conclusão objetiva de checklist e é rotulada como tal ("Itens concluídos"), nunca como "preparação"; flashcards e tempo ficam fora dela, como números à parte |
| 5 | O que fazer com `Deck.examPrepId` quando o plano é excluído | **Cascade** (o baralho criado num plano é dado exclusivo dele), com confirmação explícita antes de excluir — ver R1 |
| 6 | Flashcards antigos (sem plano) — o que fazer com eles | **Nada**: ficam soltos (`examPrepId: null`), sem migração, sem backfill, acessíveis pelas rotas atuais |
| 7 | "Vincular baralho existente" entra na v1? | **Não** — fora do escopo desta versão. A Etapa 8 só cria baralho novo já vinculado ao plano; adotar baralho solto fica pra depois, se fizer falta |
| 8 | Materiais que já apontam pra essa prova (`Attachment.examId`) | **Sugeridos automaticamente** na criação do plano, com um clique pra aceitar — o resto do acervo continua atrás do seletor manual |
| 9 | Nome interno do módulo | **`ExamPrep`** confirmado (rotas `/exam-preps`, arquivos `exam-prep.*`) |

### Plano por etapas

#### Etapa 1 — Análise da arquitetura atual ✅

**Objetivo.** Levantar o que já existe (Exam, Attachment, Deck/Flashcard,
StudySession, Estatísticas, Notes) antes de desenhar qualquer tabela nova,
pra não duplicar o que o sistema já resolve. **Banco.** Nenhuma. **Backend.**
Nenhum. **Frontend.** Nenhum. **Riscos.** Nenhum — é este documento.
**Testes.** Nenhum. **Aceite.** Este documento aprovado pelo usuário.

#### Etapa 2 — Modelagem

**Objetivo.** Criar `ExamPrep`, `ExamPrepItem`, `ExamPrepMaterial` e as
colunas `examPrepId` em `Deck`/`StudySession`. **Banco.** Migração nova:
3 tabelas + 2 colunas + índices + `@@unique([examPrepId, attachmentId])` em
`ExamPrepMaterial` + `@unique` em `ExamPrep.examId`. **Backend.** Schema
Prisma + `packages/shared/src/schemas/exam-prep.ts` (Zod: create/update de
`ExamPrep`, `ExamPrepItem`, tipos de resposta). **Frontend.** Nenhum.
**Riscos.** Nenhum — tudo aditivo, nada existente muda de forma. **Testes.**
`npx prisma migrate dev` local + `npm run typecheck`. **Aceite.** Migração
aplica limpo em banco de dev com dados reais; `prisma generate` sem erro.

#### Etapa 3 — Criação do plano a partir da prova

**Objetivo.** Menu "Criar plano de estudo"/"Ver plano de estudo" em
`ExamItem`; endpoint que cria o `ExamPrep` herdando disciplina/data/semestre
por relação. **Banco.** Nenhuma (já feita na Etapa 2). **Backend.**
`POST /exam-preps` (recebe só `examId`), `examPrepService.create` valida
prova pertence ao usuário e que ainda não tem plano (`@unique` cobre no
banco, service dá erro 409 amigável antes); `GET /exams` passa a incluir
`examPrepId` em `ExamListItem`. **Frontend.** Novo item no dropdown de
`exam-item.tsx` (`onCreateStudyPlan`/`onViewStudyPlan`), navega pra
`/plano-de-estudos/[id]`. **Riscos.** Nenhum. **Testes.** E2E real: criar
prova → criar plano → tentar criar de novo (espera 409) → excluir prova →
plano some. **Aceite.** Um clique no menu da prova leva a um plano
existente ou cria um novo, nunca duplica.

#### Etapa 4 — Dashboard do plano (casca)

**Objetivo.** Página `/plano-de-estudos/[id]` com cabeçalho (prova,
disciplina, data) e a barra de progresso, sem as seções internas ainda.
**Banco.** Nenhuma. **Backend.** `GET /exam-preps/:id` retornando o plano
com prova/disciplina resolvidas. **Frontend.** Página nova + componente de
progresso (ainda com contadores zerados). **Riscos.** Nenhum. **Testes.**
Navegar da prova até o plano e voltar. **Aceite.** Página carrega com dados
reais da prova, sem quebrar em prova sem plano ainda.

#### Etapa 5 — Conteúdos e Objetivos

**Objetivo.** CRUD de `ExamPrepItem`, dois checklists (`kind=CONTENT` e
`kind=OBJECTIVE`) com progresso próprio. **Banco.** Nenhuma. **Backend.**
`POST/PATCH/DELETE /exam-prep-items`, reordenação simples por `order`.
**Frontend.** Componente de checklist reaproveitado duas vezes (props
`kind`), painel somente-leitura com `Exam.content` e botão "Transformar em
itens". **Riscos.** R5 (conteúdo mal-formatado) — mitigado como descrito.
**Testes.** Criar/marcar/desmarcar/excluir item de cada `kind`; conferir que
a barra do dashboard (Etapa 4) atualiza. **Aceite.** Os dois checklists e a
barra de "Itens concluídos" batem com o que está marcado.

#### Etapa 6 — Anotações

**Objetivo.** Editor Tiptap embutido no plano, salvando em `ExamPrep.notes`.
**Banco.** Nenhuma. **Backend.** `PATCH /exam-preps/:id/notes`. **Frontend.**
Reaproveitar `components/notes/note-editor.tsx` (ou extrair a parte
reutilizável dele) dentro do dashboard do plano. **Riscos.** Nenhum — mesmo
editor já em produção em dois lugares. **Testes.** Editar, salvar, recarregar
a página, conferir persistência. **Aceite.** Anotação sobrevive a reload e
não é visível a outro aluno com plano na mesma prova de turma.

#### Etapa 7 — Integração com Materiais

**Objetivo.** "Adicionar material ao plano" referenciando `Attachment`
existentes, com sugestão automática dos que já têm `examId` = a prova do
plano. **Banco.** Nenhuma. **Backend.**
`POST/DELETE /exam-preps/:id/materials`, `GET` retorna sugeridos +
vinculados. **Frontend.** Seletor no padrão "já tenho essa disciplina" das
Turmas — lista com busca, checkbox múltiplo. **Riscos.** Nenhum — sem
duplicar arquivo, só a linha de junção. **Testes.** Vincular material solto,
vincular um já preso à prova (sugerido), excluir referência sem afetar o
`Attachment` original. **Aceite.** Lista de materiais do plano reflete
exatamente o que foi vinculado, e excluir do plano não exclui o material em
si.

#### Etapa 8 — Migração e integração dos Flashcards

**Objetivo.** `Deck.examPrepId` em uso: criar baralho de dentro do plano, já
vinculado. **Sem** "vincular baralho existente" (Decisão #7) e **sem**
migração de baralho antigo (Decisão #6). **Banco.** Já feita (Etapa 2);
aqui só o comportamento. **Backend.** `POST /decks` aceita `examPrepId`
opcional, validando que o plano pertence ao usuário; `GET /decks` ganha
filtro por `examPrepId`. **Frontend.** Seção Flashcards dentro do dashboard
do plano, reaproveitando os componentes de `components/flashcards/` como
estão; decisão sobre reativar ou não a entrada geral "Flashcards" na
navegação fica fora deste plano (é uma decisão de navegação, não de dado).
**Riscos.** R1, R3 (aceito). **Testes.** Criar baralho dentro do plano,
estudar, excluir o plano e confirmar que o baralho some (Cascade) enquanto
os baralhos soltos e os de outros planos não são tocados. **Aceite.** Fluxo
de estudo (fila, SM-2, avaliação) idêntico ao de hoje, só alcançado a
partir do plano; nenhum baralho pré-existente sofre alteração.

#### Etapa 9 — Sessões de estudo

**Objetivo.** Botão "Começar sessão" criando `StudySession` com
`status: IN_PROGRESS` e `examPrepId`; "Finalizar" completando com
`actualMinutes` calculado no servidor. **Banco.** Já feita (Etapa 2).
**Backend.** `POST /study-sessions/quick-start` (ou reaproveitar `POST
/study-sessions` com um `status` inicial diferente do padrão) +
`POST /study-sessions/:id/complete` já existente, sem mudança de contrato.
**Frontend.** Cronômetro simples no dashboard do plano (client-side,
`setInterval`), mostrando tempo decorrido; ao finalizar, mostra "Você
estudou por N minutos" e atualiza o contador de tempo do plano. **Riscos.**
Nenhum novo — reaproveita a máquina de estados existente. **Testes.**
Começar, aguardar, finalizar, conferir `actualMinutes` batendo com o tempo
real decorrido (tolerância de segundos); conferir que aparece nas
Estatísticas gerais no dia certo. **Aceite.** Uma sessão iniciada pelo
botão aparece completa, com minutos corretos, tanto no plano quanto no
Cronograma.

#### Etapa 10 — Integração com Cronograma

**Objetivo.** Selo linkando de volta ao plano em sessões com `examPrepId`,
dentro da tela `/cronograma` já existente; gerador automático preenche
`examPrepId` quando a prova de origem já tem plano. **Banco.** Nenhuma.
**Backend.** `schedule-generator.ts` passa a checar se a prova-alvo tem
`ExamPrep` e preencher a FK. **Frontend.** Selo/link em `SessionRow` do
Cronograma. **Riscos.** Nenhum. **Testes.** Gerar cronograma para uma prova
com plano, conferir que a sessão gerada já sai vinculada. **Aceite.** Sessão
do Cronograma leva de volta ao plano com um clique, quando aplicável.

#### Etapa 11 — Integração com Estatísticas

**Objetivo.** Confirmar que sessões do plano somam nas Estatísticas gerais
(já deveria funcionar sem mudança, por herdarem `subjectId`) e expor
"tempo estudado" no próprio dashboard do plano, calculado localmente.
**Banco.** Nenhuma. **Backend.** Endpoint do plano (`GET /exam-preps/:id`)
passa a agregar `sum(actualMinutes)` das suas próprias `StudySession`.
**Frontend.** Número de "Tempo estudado" no dashboard do plano (Etapa 4/16).
**Riscos.** Nenhum. **Testes.** Completar sessões do plano, conferir que a
soma no plano bate e que a tela de Estatísticas geral (não tocada) também
reflete, sem duplicar contagem. **Aceite.** Os dois números (plano e
Estatísticas gerais) são consistentes entre si.

#### Etapa 12 — Progresso e exclusão/integridade

**Objetivo.** Barra de "Itens concluídos" definitiva, confirmação de
exclusão do plano listando o que será apagado, exclusão em cascata
funcionando ponta a ponta. **Banco.** Nenhuma. **Backend.**
`DELETE /exam-preps/:id` retorna contagem do que será excluído antes de
confirmar (endpoint de preview, mesmo padrão de outros diálogos de
confirmação do projeto). **Frontend.** Diálogo de exclusão com a
contagem; barra final combinando conteúdos + objetivos. **Riscos.** R1.
**Testes.** Excluir prova → plano some; excluir plano → baralhos próprios
somem, materiais/baralhos de fora sobrevivem, sessões viram `examPrepId:
null` sem sumir das Estatísticas. **Aceite.** Toda regra da tabela
"Exclusão e integridade" acima, verificada uma a uma.

#### Etapa 13 — Refinamentos, testes e documentação

**Objetivo.** Polimento visual do dashboard do plano, revisão de UX do
fluxo completo (§27), testes de regressão nos módulos tocados (Materiais,
Flashcards, Cronograma, Estatísticas), e a entrada correspondente no
README (substituindo esta seção "(planejado)" pela documentação real, no
mesmo padrão das seções já existentes — Objetivo, decisões de design,
tabela de Endpoints). **Banco.** Nenhuma. **Backend.** Cobertura de testes
nos services novos. **Frontend.** Ajustes finais de layout, estados vazios
(prova sem plano, plano sem conteúdo/material/flashcard ainda). **Riscos.**
R4. **Testes.** Suite completa (`npm run typecheck`, `npm run lint`,
`npx vitest run`) + QA manual do fluxo do início ao fim. **Aceite.** Seção
"Plano de Estudos (planejado)" vira "Plano de Estudos" no Sumário e no
Roadmap, com ✅.

### Nada em aberto

As cinco perguntas levantadas na análise foram respondidas e estão
registradas como Decisões #1 a #9 acima. A única que mudou o plano em
relação ao rascunho inicial foi a de "vincular baralho existente", que saiu
do escopo (Decisão #7) e encolheu a Etapa 8. O plano está pronto para
implementação a partir da Etapa 2.

