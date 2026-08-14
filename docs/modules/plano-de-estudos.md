# Plano de Estudos

A partir de uma prova, o aluno cria um **espaço de preparação** para ela — não um módulo novo e isolado, mas um lugar que **reúne** o que o sistema já tem (materiais, flashcards, cronograma, estatísticas) mais um punhado de peças pequenas e novas (conteúdos, anotações), tudo amarrado a uma prova específica.

### Nome interno `ExamPrep`, rótulo "Plano de Estudos"

O nome sugerido originalmente (`StudyPlan`) colidia com o que o Cronograma já usa por baixo (`study-plan.routes.ts`, `study-sessions`, o schema Zod `study-plan.ts`). Mesma separação que o projeto já aplica em "Materiais" (`Attachment` por baixo) e "Cronograma" (`study-plan` por baixo): o rótulo em português não precisa ser o nome interno do código. Aqui, "Plano de Estudos" é `ExamPrep` — rotas em `/exam-preps`, arquivos `exam-prep.*`.

```
Exam (1 por aluno — já isolado por turma via fan-out da Etapa 21)
 │
 │ 1:1 — no máximo um plano por prova, por aluno (`ExamPrep.examId` é `@unique`)
 ▼
ExamPrep
 ├── notes: Json                    → anotações (Tiptap, um blob só)
 ├── items: ExamPrepItem[]          → conteúdos (checklist simples)
 ├── materials: ExamPrepMaterial[]  → referências a Attachment já existentes
 ├── decks: Deck[]                  → Deck ganha examPrepId opcional
 └── studySessions: StudySession[]  → StudySession ganha examPrepId opcional
```

Nenhum dado da prova é **copiado** para dentro do `ExamPrep` — o plano só guarda `examId` e lê disciplina/data/semestre sempre pela relação, ao vivo. Mudar a data da prova nunca deixa nada dessincronizado, porque não existe cópia para dessincronizar.

### Conteúdos

`ExamPrepItem` é um checklist simples — "o que estudar". Três status bastam (`NOT_STARTED`, `IN_PROGRESS`, `DONE`): um quarto só faria sentido com repetição, e quem repete é o flashcard, não o item da lista.

A tabela nasceu preparada para diferenciar Conteúdos de Objetivos por um campo `kind` (mesma ideia do `ClassPost.kind`), mas Objetivos não chegou a ser usado em produção e foi removido de propósito — a coluna `kind` e o enum `ExamPrepItemKind` saíram do schema (migração `remove_exam_prep_objectives`), simplificando de volta para um checklist só.

Nenhuma extração automática de conteúdo a partir de `Exam.content` — o texto cadastrado na prova aparece como um **painel de referência somente leitura**, e o botão "Transformar em itens" só quebra o texto em linhas (tirando marcadores comuns como `-`/`•`) para o aluno revisar, editar e descartar antes de salvar. É uma ação que o aluno pede, o sistema nunca interpreta ou resume sozinho.

### Anotações

Reaproveita o Tiptap que já existe nos outros dois editores do projeto (`NoteEditor`, `ClassNoteDialog`) — sem editor novo, sem biblioteca nova, sem colaboração. Guardado como um `Json` só em `ExamPrep.notes`, no padrão do `ClassNote` (um blob por lugar), não no padrão `Note`/`NoteFolder` (que existe para organizar muitas notas de uma disciplina inteira em pastas — desnecessário para a anotação de uma prova só).

### Materiais: referência, nunca cópia

O módulo de Materiais continua exatamente como era — `Attachment` continua podendo se vincular a disciplina, atividade, prova ou nada, e continua acessível fora de qualquer plano. `ExamPrepMaterial` é só uma linha de junção (`examPrepId` + `attachmentId`); excluir a referência nunca exclui o arquivo original.

Materiais que já apontam para a prova (`Attachment.examId`) aparecem **sugeridos automaticamente** no plano, com um clique para confirmar. O resto do acervo (materiais soltos, presos a outra atividade, de outra disciplina) fica atrás de um seletor manual com busca — mesmo padrão de "já tenho essa disciplina" que a tela de Turmas usa.

### Flashcards vivem dentro do plano

`Deck` ganha `examPrepId` opcional. Um baralho criado a partir do plano nasce com esse vínculo (`onDelete: Cascade` — é dado exclusivo do plano); criar/editar/estudar continua sendo exatamente o fluxo que já existe em `/flashcards/:id` (fila, SM-2, avaliação de 4 níveis), só alcançado a partir de dentro do plano.

Baralhos anteriores a esta etapa **não foram migrados**: continuam soltos (`examPrepId: null`), acessíveis pelas mesmas rotas de sempre. Não havia como migrá-los para um plano sem inventar uma prova falsa, e o sistema não cria planos genéricos sem prova. Adotar um baralho solto dentro de um plano existente ficou fora do escopo desta versão.

### Sessões de estudo: o mesmo motor do Cronograma

Nenhuma tabela nova, nenhuma máquina de estados paralela. "Começar sessão" aciona o estado `IN_PROGRESS` que o Cronograma já modelava mas nenhuma tela disparava: cria um `StudySession` com `scheduledStart = scheduledEnd = agora`, título e disciplina herdados da prova.

"Finalizar" chama o mesmo `POST /study-sessions/:id/complete` que o Cronograma já usa, **sem mudar o contrato** — só o cálculo do padrão de `actualMinutes` ficou mais esperto: um bloco `PLANNED` (fluxo normal, agendado de antemão) continua assumindo a duração planejada quando o aluno não informa o tempo; um bloco `IN_PROGRESS` (nascido de "Começar sessão") não tem duração planejada de verdade — os dois horários nasceram iguais —, então o padrão vira o tempo real decorrido desde o início, **calculado no servidor**, nunca confiando só no cronômetro do cliente.

### Integração com o Cronograma

A tela `/cronograma` mostra um selo "Do plano" (com link de volta) em qualquer sessão que tenha `examPrepId`. O gerador automático (`schedule-generator.ts`) não muda nada do próprio algoritmo — só passa a preencher `examPrepId` de graça quando a prova de origem já tem um plano, via um mapa `examId → examPrepId` buscado antes de gravar os blocos gerados.

### Integração com Estatísticas

Nenhuma mudança foi necessária no módulo de Estatísticas. Como toda `StudySession` de um plano herda o `subjectId` da prova, ela já entra nas somas existentes (`studyMinutesByDay`, `studyMinutesBySubject`, `highlights.studiedMinutes`) sem tocar em `statistics.service.ts` — confirmado por teste de ponta a ponta, não só por leitura de código. O "tempo estudado" que aparece **dentro do dashboard do próprio plano** é outra conta, menor: a soma de `actualMinutes` só das sessões daquele `examPrepId`, calculada na hora — não duplica nem diverge do número geral.

### Progresso: "Itens concluídos", nunca "Preparação"

A barra do dashboard mede só a fração objetiva de conteúdos marcados como concluídos, e é rotulada exatamente assim — nunca como uma estimativa de quão pronto o aluno está para a prova. Flashcards estudados e tempo estudado ficam **fora** da barra de propósito: nenhum dos dois tem um teto natural de "concluído" (sempre dá para estudar mais um cartão, mais um minuto), e forçá-los numa porcentagem geraria exatamente o número artificial que o design evita.

### Exclusão: o que some, o que fica

| Evento | Efeito |
| --- | --- |
| Excluir a prova (`Exam`) | `ExamPrep` sai em cascata, como já acontecia com `Attachment`/`StudySession` presos à prova |
| Excluir o plano (`ExamPrep`) | Saem: `ExamPrepItem`, `ExamPrepMaterial` (só a referência — o `Attachment` sobrevive), `Deck`/`Flashcard` criados dentro dele. Ficam: a prova, a disciplina, materiais originais, baralhos de outros planos, e o tempo já contado nas Estatísticas (`StudySession.examPrepId` vira `null`, a sessão em si não some) |

Como excluir o plano apaga baralhos de verdade, a tela sempre mostra antes uma prévia contando exatamente o que vai junto (`GET /exam-preps/:id/deletion-preview`) — nunca uma exclusão silenciosa de flashcards.

### Privacidade em Turmas, sem regra extra

Uma prova publicada numa turma já vira, para cada aluno, uma cópia pessoal de `Exam` (fan-out da Etapa 21). Um plano preso a essa cópia pessoal já nasce privado: dois alunos da mesma turma, mesma prova publicada, cada um com seu próprio plano, sem ver anotações, flashcards ou progresso um do outro — porque tecnicamente são `Exam`s diferentes, não porque o plano carrega uma flag de privacidade.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/exam-preps` | Cria o plano a partir de uma prova (`examId`) |
| GET | `/exam-preps/:id` | Detalhe completo: itens, anotações, materiais, flashcards, progresso, sessão ativa |
| GET | `/exam-preps/:id/deletion-preview` | Contagem do que será perdido, antes de confirmar |
| DELETE | `/exam-preps/:id` | Exclui o plano |
| POST | `/exam-preps/:id/items` | Cria um conteúdo |
| POST | `/exam-preps/:id/items/bulk` | "Transformar em itens" — cria vários de uma vez |
| PATCH | `/exam-prep-items/:itemId` | Edita título/status |
| DELETE | `/exam-prep-items/:itemId` | Exclui o item |
| PATCH | `/exam-preps/:id/notes` | Salva as anotações (autosave) |
| POST | `/exam-preps/:id/materials` | Vincula um material já existente |
| DELETE | `/exam-prep-materials/:materialId` | Desvincula (não apaga o material original) |
| POST | `/study-sessions/quick-start` | "Começar sessão" — cria um bloco `IN_PROGRESS` agora |

Os demais endpoints de sessão (`complete`, `skip`, `reopen`, `delete`) são os mesmos do [Cronograma](cronograma.md); `POST /decks` e `POST /flashcards` são os mesmos de [Flashcards](flashcards.md), só aceitando `examPrepId` opcional na criação do baralho.
