# Etapa 30 — Semestre como hierarquia central (Turma + Período do curso)

## Problema

A investigação da Etapa "polimento de UX" (conversa que originou este plano) mapeou a árvore Semestre → Disciplina → Turma → Prova como ela existe hoje e achou três problemas de raiz, não só de texto de tela:

1. **`Class` (Turma) não referencia `Semester` nenhum.** Tem só `year`/`term` soltos (`apps/api/prisma/schema.prisma:1030-1058`), desconectados por completo dos registros de `Semester` que aparecem em Histórico. Cada membro (inclusive o dono) traduz esse par pra um `Semester` **pessoal** próprio via `resolveMemberSemester` (`class-subject-linking.service.ts:22-57`), então "o semestre da turma" hoje não é um dado, é uma inferência recalculada toda hora.
2. **A palavra "Período" já significa duas coisas incompatíveis na interface de hoje**, antes mesmo de eu introduzir o conceito novo que este plano pede: o campo de metade do ano civil se chama "Período" no form de Semestre (`semester-form-dialog.tsx:132`) e "Semestre" no form de Turma (`class-form-dialog.tsx:138`) — mesmo dado, dois rótulos, nenhum dos dois é o "período do curso" (1º a 8º) que você quer adicionar agora.
3. **Não existe conceito de "avançar a turma pro próximo semestre"**. O único "encerrar semestre" que existe hoje é 100% pessoal (`semesterService.close`, congela nota final de cada disciplina do usuário) e nunca toca em `Class`/`ClassMember`/`ClassSubject`.
4. **Um usuário pode participar de várias turmas ativas ao mesmo tempo hoje** — `ClassMember` só impede duplicar a mesma turma (`@@unique([classId, userId])`), não impede estar em turmas diferentes simultaneamente. Isso fica ainda mais confuso depois que a turma passar a controlar semestre/período: não faz sentido alguém estar "em dois períodos do curso ao mesmo tempo".

Este documento propõe fechar os quatro de uma vez: `Class` passa a ter um `semesterId` de verdade, ganha um campo `period` (1-8, contador de progresso no curso, conceito **diferente** de `Semester.term`), uma ação nova "Finalizar semestre" que avança os dois automaticamente e arquiva o conteúdo do ciclo anterior, e um limite de uma participação ativa por usuário.

## Conceitos — não confundir

| Termo | O que é | Onde mora | Intervalo |
| --- | --- | --- | --- |
| **Semestre** (`Semester`) | Um recorte de **tempo**: "primeiro semestre de 2026" = 01/01 a ~30/06. Pessoal, por usuário. | Já existe (`Semester.year` + `Semester.term`) | `term` é 1 ou 2 |
| **Período** (`Class.period`, campo novo) | Contador de **progresso da turma no curso**: em que semestre da grade curricular aquela turma está. Coletivo, pertence à Turma, não ao usuário. | Novo, só em `Class` | 1 a 8 (curso de 4 anos) |

Cada vez que a turma finaliza um semestre, os dois andam juntos: `period += 1` e `semesterId` aponta pro próximo `Semester` (ano/metade seguinte). Nunca é possível pular ou desalinhar os dois nesta proposta — sempre andam 1 a 1.

**Confirmado**: incremento é sempre **+1 por finalização, sem gap** — quem está há 6 semestres na faculdade está no 6º período (o "5º período" do rascunho original foi um erro de digitação; o exemplo completo 2026.1/7º período → 2026.2/8º período é a regra correta).

> ℹ️ Existe um segundo plano, separado de propósito (mais fácil de desfazer isoladamente), que muda como `Semester` nasce — ver [`semestre-automatico.md`](semestre-automatico.md), Etapa 31. Os dois são compatíveis: aquele plano só muda **quem cria** um `Semester` (automático, sem formulário) e o que "Encerrar" significa; a mecânica de `resolveMemberSemester`/`Class.semesterId` descrita aqui não muda.

## Decisões propostas

| # | Pergunta | Proposta |
| --- | --- | --- |
| 1 | De quem é o `Semester` que `Class.semesterId` aponta? | **Do dono da turma.** Reaproveita a infraestrutura que já existe (`resolveMemberSemester` já roda pro dono hoje) em vez de inventar um "Semester sem dono" novo. Cada outro membro continua com o `Semester` pessoal dele (`ClassMember.semesterId`), como hoje — só o dono tem o registro que a `Class` referencia diretamente. |
| 2 | O que acontece se o dono tentar apagar o `Semester` que uma turma dele está usando? | **Bloqueado** (`onDelete: Restrict` na FK + validação explícita no service, mensagem clara). Um semestre "em uso" por uma turma ativa não pode sumir por baixo dela. |
| 3 | "Finalizar semestre" da turma também tranca as notas pessoais de todo mundo (o `semesterService.close` que já existe)? | **Não.** Ficam desacoplados de propósito. "Finalizar semestre" da turma só avança o *cursor* coletivo (quais disciplinas/provas/avisos aparecem como "atuais"); fechar o semestre pessoal (congelar nota final) continua sendo uma decisão individual de cada membro, feita em Histórico, no ritmo dele. |
| 4 | Turmas que já existem no banco no momento em que a migração da Etapa 30.3 roda (registros criados pelo formulário atual, antes de "período" existir como campo) recebem qual período? | **1 por padrão na migração, mas de verdade editável depois** — não como promessa solta: a Etapa 30.7 (nova) constrói a tela de editar turma especificamente pra isso. Sem essa tela, "editável depois" seria uma decisão inviável: turmas de gente já em período avançado (ex.: 5º) que só for cadastrar a turma agora ficariam presas num número errado para sempre. O valor de 1 na migração é só um placeholder de partida - não é a resposta certa pra ninguém que já está além do 1º período, e a expectativa é que quem estiver nessa situação corrija na hora que a Etapa 30.7 estiver no ar. |
| 5 | Onde a sugestão guiada de criar semestre ("criar 2026.1 com um clique") aparece nesta etapa? | **Só dentro do form de criar Turma**, como pedido. Os mesmos dropdowns vazios em Disciplina/Prova continuam como estão hoje — fica registrado como possível próxima etapa, não faz parte desta. |
| 6 | Como tirar a palavra "Período" do form de Semestre sem quebrar nada? | Renomear só o **rótulo** do campo (hoje diz "Período", os itens do dropdown já dizem corretamente "1º semestre"/"2º semestre") para algo que não colida, ex. "Metade do ano". Depois desta etapa, "Período" (sozinho, sem qualificador) só existe em um lugar do app: o campo novo da Turma. |
| 7 | 8 períodos é fixo no código ou configurável? | **Fixo** (`.max(8)` no Zod, igual o `term` de Semestre já é `.max(2)` fixo hoje — nenhuma validação deste tipo no projeto é parametrizável). Se um dia o app precisar servir cursos de duração diferente, isso vira uma etapa própria. |
| 8 | Um usuário que já é dono ou membro ativo de uma turma pode criar ou entrar em outra? | **Não** — no máximo uma participação ativa por vez, seja como dono ou como membro comum (as duas são a mesma linha de `ClassMember` pra esta regra). Precisa sair da turma atual primeiro. |
| 9 | Uma turma arquivada conta pra esse limite? | **Não.** `Class.archivedAt` preenchido libera o usuário pra entrar/criar outra, mesmo sem ele ter "saído" explicitamente da arquivada. |
| 10 | O que fazer com usuários que hoje já participam ativamente de mais de uma turma (a restrição nunca existiu antes)? | **Não é um problema real.** A plataforma ainda não está em uso — não há dado de produção pra migrar. Se algum dia isso acontecer (ex.: dado de teste local), a resolução é manual e simples: o próprio usuário arquiva uma das turmas antes da migração rodar. |
| 11 | Como fica a listagem de turmas na sidebar, já que ninguém tem mais de uma? | **Some.** Clicar em "Turmas" leva direto pra visão geral da única turma ativa, sem passar por uma lista de um item só. Ver Etapa 30.2. |
| 12 | "Finalizar semestre" da turma merece uma pré-visualização antes de confirmar, como o fechamento pessoal (`close-preview`) já tem? | **Sim.** O impacto é maior que o fechamento pessoal (afeta o que todo o grupo vê como "atual", não só quem clica) - ganha o mesmo padrão, um `GET .../finish-semester-preview` antes do `POST` que executa de verdade. Ver Etapa 30.5. |
| 13 | "Disciplinas e provas atuais saem da visão principal" (Etapa 30.8) significa que ficam inacessíveis? | **Não - nada é apagado nem escondido de verdade.** É só o filtro *padrão* das abas Disciplinas/Publicações que muda pra mostrar o ciclo novo; o ciclo anterior continua inteiro, pra sempre, na aba Histórico da turma - a mesma garantia que o Histórico pessoal já dá hoje. Histórico da turma é visível pra **qualquer membro ativo**, não só o dono (mesma visibilidade que Disciplinas/Publicações já têm hoje) - só a ação de finalizar em si é exclusiva do dono. |

## Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | Migração de dado (`Class.year`/`term` soltos → `semesterId`) perder ou duplicar vínculo | Script de migração roda dentro de uma transação, reaproveitando o `resolveMemberSemester` já existente e testado, com conferência de contagem antes de aceitar — mesmo padrão usado no backfill de `AuthIdentity` da Etapa 26 |
| R2 | "Finalizar semestre" precisa resolver/criar o `Semester` pessoal de **todo** membro ativo (fan-out), pode ficar lento em turmas grandes | Mesma operação em ordem de grandeza que o backfill que `addSubject` já faz hoje pra cada membro ativo — aceitável na escala atual do projeto; medir tempo de resposta ao testar com uma turma de tamanho real |
| R3 | Confusão residual entre "Período" (curso, 1-8) e o campo de metade do ano, mesmo depois de renomear | Nunca usar a palavra "Período" sozinha para metade do ano em nenhuma tela, texto de erro ou schema Zod novo daqui pra frente |
| R4 | `ClassSubject`/`ClassPost` existentes (pré-migração) ficarem sem `semesterId`, quebrando o filtro "mostrar só o período atual" | Backfill tagueia todo `ClassSubject`/`ClassPost` já existente com o `semesterId` resolvido da própria turma (são exatamente do ciclo que a turma estava rodando até aqui — não é um chute) |
| R5 | Dono confunde "Finalizar semestre" com uma ação reversível, ou membros acham que o conteúdo do período anterior foi apagado | Diálogo de confirmação com pré-visualização real (Decisão #12) antes de executar, deixando claro que nada é apagado — só passa a viver na aba Histórico da turma (Decisão #13), igual o `CloseSemesterDialog` pessoal já faz |
| R6 | Dado existente pode já ter usuários ativos em 2+ turmas simultaneamente (restrição nova, nunca existiu antes) | Baixo — plataforma ainda não está em uso, sem dado de produção em risco. Se acontecer (ex.: ambiente local de teste), resolução é manual: usuário arquiva uma das turmas (Decisão #10) |

## Plano por etapas

### Etapa 30.1 — Banco: um aluno participa de no máximo uma turma ativa por vez

**Objetivo.** Garantir que cada usuário tenha, no máximo, uma participação ativa (`ClassMember.status: ACTIVE`) em turmas não arquivadas por vez — dono ou membro comum, é a mesma regra. Fecha uma ambiguidade que ficaria pior a partir da Etapa 30.3 em diante: não faz sentido um usuário estar "em dois períodos do curso ao mesmo tempo".

**Decisões.**
- Conta como participação ativa tanto ser dono quanto ser membro comum — os dois são linhas de `ClassMember`, sem distinção pra esta regra.
- Uma turma arquivada (`Class.archivedAt` preenchido) não conta contra o limite — quem só tinha uma turma e ela foi arquivada fica livre pra entrar/criar outra sem precisar "sair" manualmente de algo que já não está mais ativo.
- Sair de uma turma (`status → LEFT`) sempre libera o usuário pra entrar em outra, imediatamente.

**Banco.** Reforço primário na camada de serviço (mensagem de erro clara), no mesmo padrão de outras regras de negócio deste projeto que não viram `CHECK` de banco (ex.: limite de tentativas de senha, dependência entre módulos). Como reforço adicional, a migração pode incluir um índice único parcial (`CREATE UNIQUE INDEX ... ON class_members (userId) WHERE status = 'ACTIVE'`) como rede de segurança contra um bug futuro que burle a checagem do service — Prisma não expressa índice parcial direto no `schema.prisma`, precisa de SQL editado à mão dentro da migração gerada.

**Backend.** Novo guard, chamado em dois pontos: `class.service.create` (criar turma = virar dono = virar `ClassMember` ativo) e o fluxo de aceitar convite (join por link/código). Antes de criar a linha de `ClassMember`, verifica se o usuário já tem alguma participação `ACTIVE` em outra turma não arquivada; se tiver, rejeita com mensagem clara ("Você já participa de uma turma ativa — saia dela antes de entrar em outra").

**Migração.** Hoje essa restrição não existe, mas não é um problema prático: a plataforma ainda não está em uso, então não há dado de produção com usuários em duas turmas ativas ao mesmo tempo pra migrar. Se algum ambiente de teste local tiver esse caso, a resolução é manual e simples — o próprio usuário arquiva uma das turmas antes da migração aplicar a restrição.

**Aceite.** Usuário ativo numa turma não consegue criar nem entrar em outra (mensagem clara, nunca um 500 ou comportamento silencioso). Sair da turma atual, ou ela ser arquivada, libera imediatamente a criação/entrada em outra.

**Testes.** Teste de integração cobrindo: criar turma enquanto já é dono de outra (bloqueado); entrar por convite enquanto é membro de outra (bloqueado); as mesmas duas ações depois de sair da turma anterior (permitido); as mesmas duas ações quando a turma anterior está arquivada (permitido).

---

### Etapa 30.2 — Frontend: sidebar leva direto pra visão geral da Turma

**Objetivo.** Como cada usuário participa de no máximo uma turma ativa (Etapa 30.1), a tela de listagem de turmas nunca mostra mais de um card pra clicar — então não faz sentido continuar sendo uma lista. Clicar em "Turmas" na sidebar deve levar direto pra visão geral da turma que o usuário já faz parte.

**Frontend.**
- `/turmas` passa a checar, ao carregar, se o usuário tem uma participação ativa; se tiver, redireciona automaticamente pra `/turmas/{id}` (visão geral), sem passar por uma listagem intermediária.
- A tela atual de listagem (grid de cards + "Criar turma"/"Entrar com convite") só continua aparecendo quando o usuário **não** tem nenhuma participação ativa — que já é, essencialmente, o estado vazio de hoje.
- Como nunca existe mais de um item pra listar, a lógica de "grid de cards de turma" deixa de fazer sentido e pode ser removida — simplifica a página em vez de só redirecionar por cima dela.

**Aceite.** Usuário com turma ativa que clica em "Turmas" na sidebar cai direto na visão geral, sem nenhum clique extra. Usuário sem turma continua vendo a tela de criar/entrar, sem mudança nenhuma pra esse caso.

**Testes.** Verificação manual: com turma ativa (redireciona direto), sem turma (mostra a tela de criar/entrar), e o caso de transição (acabou de sair da turma → volta a ver a tela de criar/entrar).

---

### Etapa 30.3 — Banco: Turma referencia Semestre de verdade

**Objetivo.** `Class` ganha `semesterId` (FK obrigatória pro `Semester` do dono) e `period` (1-8); `ClassSubject` e `ClassPost` ganham `semesterId` próprio, tagueando a qual ciclo pertencem. `Class.year`/`Class.term` somem, substituídos pela leitura via `class.semester.year`/`.term`.

**Banco.**
- `Class`: `+ semesterId String` (FK → `Semester`, `onDelete: Restrict`), `+ period Int`, `- year`, `- term`.
- `ClassSubject`: `+ semesterId String` (FK → `Semester`, `onDelete: Restrict`) — a que ciclo da turma esta disciplina-molde pertence.
- `ClassPost`: `+ semesterId String` (mesma FK) — a que ciclo esta publicação pertence.
- `Semester` ganha as back-relations correspondentes (`classesAsCanonical`, `classSubjects`, `classPosts`).
- **Migração com passo de dado, não só DDL**: para cada `Class` existente, resolver-ou-criar o `Semester` do dono com o `(year, term)` atual (reaproveitando `resolveMemberSemester` tal como está), setar `Class.semesterId`, setar `Class.period = 1`, e tagueiar todo `ClassSubject`/`ClassPost` daquela turma com o mesmo `semesterId` resolvido. Roda em transação, com conferência de contagem (linhas migradas = linhas esperadas) antes de confirmar — mesmo padrão da migração de backfill de `AuthIdentity` (Etapa 26).

**Backend.** `class.service.create`: em vez de gravar `year`/`term` brutos, recebe `semesterId` (já resolvido/criado pelo frontend, ver 30.6) + `period`, grava direto. `class.service.addSubject` e `ensureMemberSubjectLink`: `ClassSubject`/`ClassPost` novos herdam `semesterId = class.semesterId` no momento da criação (nunca recalculado depois). `resolveMemberSemester` não muda de assinatura — continua resolvendo o semestre pessoal de qualquer membro a partir de `(year, term)`, só passa a ser alimentado por `class.semester.year`/`.term` em vez do par solto.

**Aceite.** Nenhuma turma existente perde disciplina, publicação ou membro na migração. `Class.year`/`Class.term` não existem mais em lugar nenhum do código (`grep` limpo). Toda disciplina/publicação nova criada numa turma carrega o `semesterId` correto automaticamente, sem o usuário precisar informar nada.

**Testes.** Migração testada manualmente contra uma cópia do banco de desenvolvimento antes de ir pra produção (mesmo procedimento já usado nas migrações anteriores deste projeto). Nenhuma regra pura nova aqui — é essencialmente um reshape de schema + reencadeamento de chamadas já existentes.

---

### Etapa 30.4 — Unificar sugestão de semestre e tirar a ambiguidade de "Período"

**Objetivo.** Uma função só decide "que semestre sugerir a partir de hoje" (nome, ano, `term`, datas de início/fim) — hoje existem **duas versões divergentes** da mesma regra (frontend: fev-jun/ago-dez; backend `defaultSemesterDates`: fev-jul/jul-dez). E renomear o campo do form de Semestre que hoje se chama "Período" sem ser um período de curso.

**Decisões.**
- A regra de corte (mês < junho → 1º semestre, senão 2º) que já está em `semester-form-dialog.tsx:79` é a que bate exatamente com os exemplos que você deu (01/01 → X.1, 01/07 → X.2) — ela **fica**, só sai do componente React e vira uma função pura reaproveitável.
- As datas de início/fim de cada opção divergem hoje entre front e back; este plano padroniza em cima do que o backend já usa (`defaultSemesterDates`: 1º fev - 15 jul / 16 jul - 20 dez), por ser o que efetivamente é gravado quando um `Semester` nasce de dentro de uma turma hoje.

**Backend/Compartilhado.** Nova função pura em `packages/shared` (ex. `suggestSemesterFromDate(date: Date)`), devolvendo `{ name, year, term, startDate, endDate }`. Usada por: `defaultSemesterDates`/`resolveMemberSemester` (backend) e pelo form de criar Semestre e pelo novo atalho de criação-guiada dentro do form de Turma (frontend) — mesma fonte de verdade nos dois lados.

**Frontend.** `semester-form-dialog.tsx`: troca o `label="Período"` do campo de 1/2 por algo que não colide (ex. "Metade do ano"); os itens do próprio `Select` ("1º semestre"/"2º semestre") não mudam, já estavam certos.

**Aceite.** Criar um semestre pela tela de Histórico e criar um semestre pelo atalho novo de dentro da Turma (Etapa 30.6) sugerem exatamente o mesmo nome/ano/período/datas pra a mesma data de hoje. Em nenhuma tela do app a palavra "Período" aparece mais se referindo à metade do ano civil.

**Testes.** `suggestSemesterFromDate` testada por unidade cobrindo as bordas: 31/12, 01/01, 30/06, 01/07 (exatamente os exemplos que você deu), com mutação deliberada da comparação de mês pra confirmar que o teste pega a regressão.

---

### Etapa 30.5 — Backend: ação "Finalizar semestre" da turma

**Objetivo.** Endpoint novo que avança a turma pro próximo semestre/período automaticamente, arquivando o ciclo atual sem apagar nada — com uma pré-visualização antes de executar de verdade (Decisão #12).

**Backend.**
- `GET /classes/:id/finish-semester-preview`, só o dono. Devolve, sem gravar nada: o próximo `(year, term)`/nome de semestre calculado, o próximo número de período, e uma contagem do que vai para o Histórico da turma (quantas disciplinas, quantas publicações) — mesmo espírito do `close-preview` pessoal que já existe.
- `POST /classes/:id/finish-semester`, só o dono (`requireOwner`, mesmo guard já usado em `addSubject`). Sequência:
  1. A partir do `Semester` atual da turma, calcula o próximo `(year, term)`: `term 1 → term 2` (mesmo ano); `term 2 → term 1` (ano seguinte).
  2. Roda `resolveMemberSemester` pro **dono** nesse próximo `(year, term)` — pode reaproveitar um `Semester` pessoal que ele já tenha (ex.: já criou manualmente em Histórico) ou criar um novo pela regra da Etapa 30.4.
  3. Faz o mesmo fan-out pra **cada membro ativo** da turma (`listActiveMembersWithSemester`, já existe), atualizando o `semesterId` pessoal de cada um — mesmo padrão de "backfill em lote" que `addSubject` já faz hoje.
  4. Atualiza `Class.semesterId` pro novo semestre do dono e incrementa `Class.period` em 1.
  5. **Não** cria `ClassSubject`/`ClassPost` novos automaticamente — o período novo começa sem disciplinas, igual uma turma nova (você confirmou que o esperado é "outras disciplinas, outras provas"; o dono adiciona o que for do novo período pela mesma tela de sempre).
  6. **Não** toca em `semesterService.close` de ninguém (Decisão #3).
  7. **Não apaga nem esconde** nenhuma `ClassSubject`/`ClassPost` do ciclo anterior — elas continuam no banco, com o `semesterId` antigo, e passam a ser lidas pela aba Histórico da turma (Decisão #13, Etapa 30.8) em vez da aba principal.

**Aceite.** A pré-visualização mostra os números certos antes de qualquer gravação. Depois de finalizar de verdade, `GET /classes/:id` devolve o novo `semesterId`/`period`; toda disciplina/publicação criada depois pertence ao novo ciclo; nada do ciclo antigo é apagado ou alterado - só para de aparecer na aba principal.

**Testes.** Teste de integração cobrindo: pré-visualização devolvendo os números certos sem gravar nada; virada dentro do mesmo ano (term 1→2) e virada de ano (term 2→1, year+1); turma com múltiplos membros recebendo `semesterId` pessoal correto cada um; chamada por quem não é dono é rejeitada (nos dois endpoints).

**Fora do escopo desta etapa.** Cópia automática de disciplinas do período anterior pro novo (decisão explícita: não copiar, ver passo 5 acima).

---

### Etapa 30.6 — Frontend: criação de Turma com Semestre real + Período do curso

**Objetivo.** `class-form-dialog.tsx` troca o dropdown solto de "Semestre" (1/2) por um seletor de `Semester` de verdade, com sugestão guiada quando não existe nenhum, e ganha o campo novo "Período" (1º a 8º).

**Frontend.**
- Campo **Semestre**: dropdown listando os `Semester`s do usuário. Se a lista estiver vazia, em vez do dropdown mudo de hoje, mostra um atalho "Criar {sugestão, ex: 2026.1}" (usando `suggestSemesterFromDate` da Etapa 30.4) que cria o semestre ali mesmo, sem sair do diálogo de criar turma — mesmo padrão de inline-create que "+ Cadastrar novo professor" já usa neste mesmo formulário.
- Campo **Período** novo: `Select` com as 8 opções fixas (1º a 8º).
- O resto do formulário (nome, cor, descrição, disciplinas iniciais) não muda.

**Aceite.** Usuário sem nenhum semestre cadastrado consegue criar uma turma do zero — semestre incluso — sem sair da tela nem ir em Histórico primeiro. Botão "Nova turma" nunca mais leva a um formulário com dropdown de semestre vazio e sem saída.

**Testes.** Verificação manual do fluxo completo (sem semestre → sugestão aparece → cria inline → turma criada com o semestre certo), já que é interação de UI ponta a ponta.

---

### Etapa 30.7 — Frontend: editar turma (nome, cor, descrição, período)

**Objetivo.** Hoje não existe nenhuma tela de editar turma — `ClassFormDialog` só é usado pra criação (`turmas/page.tsx:85`) e o hook `useUpdateClass` já existe mas nenhuma UI o chama. Sem essa tela, a Decisão #4 (período editável depois) seria uma promessa vazia. O backend já está pronto: `PATCH /classes/:id` já existe (`class.controller.update`), e `updateClassSchema` é `classBaseSchema.partial()` — herda `period` automaticamente assim que a Etapa 30.3 adicionar o campo à base, sem precisar de nenhum trabalho de backend novo nesta etapa.

**Decisões.**
- Campos editáveis: nome, cor, descrição, período. **`semesterId` fica de fora** — a única forma sancionada de mudar o semestre da turma é "Finalizar semestre" (Etapa 30.5), pra nunca desalinhar `period` e `semesterId` por uma edição manual solta.
- Só o dono edita (mesmo `requireOwner` já usado em outras ações de turma).

**Frontend.** Novo diálogo (ou reaproveita `ClassFormDialog` num modo de edição, pré-preenchido) acessível a partir da visão geral da turma, chamando o `useUpdateClass` que já existe.

**Aceite.** Dono corrige o período de uma turma (própria ou herdada da migração da Etapa 30.3) sem precisar de suporte/acesso direto ao banco. Alguém que já está no 5º período do curso e só agora está cadastrando a turma no app consegue começar direto no período certo — seja escolhendo na criação (Etapa 30.6) ou corrigindo logo em seguida aqui.

**Testes.** Teste de integração: dono edita período (aceito, dentro de 1-8); tentativa de editar `semesterId` diretamente por essa rota é ignorada/rejeitada; quem não é dono não consegue editar.

---

### Etapa 30.8 — Frontend: "Finalizar semestre" na Turma + Histórico da turma

**Objetivo.** Dono ganha a ação de finalizar semestre na tela da turma; a turma passa a mostrar só o conteúdo do período atual por padrão. **Nada é apagado nem fica inacessível** (Decisão #13) — o conteúdo do período anterior só muda de aba, pra Histórico, visível a qualquer membro ativo, não só o dono.

**Frontend.**
- Botão "Finalizar semestre" (só visível pro dono), abrindo um diálogo que primeiro busca a pré-visualização (`GET .../finish-semester-preview`, Etapa 30.5) e mostra os números reais antes de confirmar: "Vai avançar a turma para {semestre seguinte}, {período seguinte}º período. {N} disciplinas e {M} publicações do ciclo atual passam a viver só na aba Histórico — nada é apagado." Só então o dono confirma e o `POST` roda de verdade.
- As abas/listas de Disciplinas e Publicações da turma passam a filtrar por `semesterId === turma.semesterId` (o atual) por padrão.
- Nova aba **Histórico**, dentro da turma, visível a qualquer membro ativo (não só o dono) — lista os períodos anteriores (agrupados por `period`/`semesterId`), somente leitura.

**Aceite.** Depois de finalizar, a aba principal de Disciplinas/Publicações mostra só o período novo; tudo do período anterior continua existindo e acessível, sem exceção, na aba Histórico da turma - pra qualquer membro, não só pra quem finalizou.

**Testes.** Verificação manual do fluxo completo (pré-visualização mostra números corretos → confirma → conteúdo antigo sai da aba principal → aparece intacto na aba Histórico da turma, visível também pra um membro comum, não só o dono → dono adiciona disciplina nova → aparece só na visão principal do período novo).

---

### Etapa 30.9 — Frontend: cards de Prova/Publicações no padrão do projeto

**Objetivo.** A lista de publicações dentro da turma hoje mistura aviso/atividade/prova/evento num único `Card` genérico por item, com todos os metadados espremidos numa linha só concatenada por "·" — sem cor de disciplina, sem indicador de urgência, sem separação por tipo. É essa mistura sem separação, não o tamanho de cada card isoladamente, que causa a sensação de "extenso demais".

**Frontend.**
- Extrai um componente de linha compacto por publicação, no padrão visual do `ExamRow` do Dashboard (barra de cor da disciplina, título em até 2 linhas com `line-clamp`, data com destaque de urgência quando aplicável para provas, sala quando houver) — em vez do `Card` genérico de hoje com tudo numa linha só.
- Separa a lista de "Publicações" por tipo (Provas / Atividades / Avisos / Eventos) em vez de uma única lista interleaved — cada seção usando o componente novo.
- Isso já nasce escopado ao "período atual" pela Etapa 30.8 — sem esse filtro, a lista tenderia a crescer sem limite ao longo dos semestres.

**Aceite.** Nenhuma publicação perde informação que já era exibida hoje (sala, contagem de cópias, etc. continuam visíveis, só reorganizados). Visual consistente com `ExamRow`/`ExamItem` do resto do projeto — não parece um componente à parte.

**Testes.** Nenhuma regra pura nova; verificação visual manual em larguras de tela variadas (mobile e desktop), consistente com a prática já usada nas telas de calendário/dashboard.

## Fora do escopo deste plano

- Sugestão guiada de criar semestre nos formulários de Disciplina e Prova (dropdowns vazios continuam como estão hoje).
- Cópia automática de disciplinas de um período pro próximo ao finalizar semestre.
- Tornar "8 períodos" configurável por curso/instituição.
- Fechar (congelar nota final) o semestre pessoal de todos os membros automaticamente ao finalizar o semestre da turma.
- Como `Semester` nasce/é gerenciado — ver plano separado [`semestre-automatico.md`](semestre-automatico.md).
