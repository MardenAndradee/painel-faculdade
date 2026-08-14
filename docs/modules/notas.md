# Notas

### Componentes de avaliação configuráveis, não um enum fixo

Antes da Etapa 17, `Grade.type` era um enum fixo (`P1, P2, P3, ASSIGNMENT, SEMINAR, ...`) — o sistema "sabia" que existiam P1/P2/P3, preso ao modelo de uma instituição específica. Agora o sistema só sabe que existem **componentes de avaliação configuráveis**, definidos pelo próprio usuário:

```
Semester
   │
   └── GradeConfiguration (modelo padrão, opcional)
          └── GradeComponent[]  (nome, peso, ordem)

Subject
   │
   └── GradeConfiguration (1-1, sempre independente)
          └── GradeComponent[]  (copiados do modelo do semestre ao criar a disciplina;
                                  editar depois nunca afeta o modelo nem outras disciplinas)

Grade
   ├── gradeComponentId  (o peso usado na média vem do componente, não é mais digitado à mão)
   ├── value / maxValue  (cada lançamento guarda sua própria escala)
   └── examId?           (vínculo opcional com uma prova)

Exam
   └── gradeComponentId?  ("esta prova é referente a qual componente" — e de onde vem o peso dela)
```

`GradeConfiguration.subjectId` e `.semesterId` são FKs independentes (mesmo padrão de `Grade.examId`/`.assignmentId`) — uma configuração pertence a exatamente uma coisa: uma disciplina (o caso normal, usado no cálculo) ou um semestre (um modelo padrão, que só serve para pré-preencher disciplinas novas). Um componente com nota já lançada não pode ser excluído (`Grade.gradeComponentId` usa `onDelete: Restrict`) — a API recusa com uma mensagem clara em vez de deixar o erro estourar como violação de constraint.

### Nota necessária para aprovação

```
necessária = (aprovação × pesoTotal − pontosObtidos) ÷ pesoRestante
```

O peso restante vem dos **componentes configurados que ainda não têm nota** — dado real, nunca uma suposição de peso total fixo. Exemplo com aprovação 6, N1 (peso 3, nota 2,5) e N2 (peso 4, nota 8) lançadas, N3 (peso 3) pendente:

`(6 × 10 − 39,5) ÷ 3 = 6,83`

Sem componentes pendentes, `requiredGrade` é **`null`** — a interface não inventa um número. Quando mais de um componente está pendente, o resultado assume que todos precisam da mesma nota ("precisa de X em N2, N3").

Essa é a **única** implementação do cálculo — antes da Etapa 17, a tela de Notas e o detalhe da disciplina tinham cada uma a sua própria estimativa, que podiam divergir para a mesma disciplina. Hoje ambas chamam `gradeService.getSubjectSummary`.

| Status | Condição |
| --- | --- |
| Aprovado | Média já garante a aprovação mesmo zerando o restante |
| Atenção | Ainda é possível, mas exige nota ≥ 7 no que falta |
| Em andamento | Precisa de menos de 7 no restante |
| Reprovado | Nem com nota máxima alcança a média |
| Sem notas | Nada lançado ainda |

Uma prova de 100 pontos e um trabalho de 10 são comparáveis: tudo é normalizado para 0–10 antes de ponderar. A interface mostra o valor original **e** o equivalente (`80/100 = 8,0`).

### Simulação

Calculadora client-side (`apps/web/lib/grade-math.ts` espelha `apps/api/src/utils/grade-calculator.ts` — mesma álgebra dos dois lados). Carrega as notas reais já lançadas como ponto de partida, mas qualquer campo — inclusive os já lançados — pode ser editado livremente para explorar cenários. **Nada é salvo**: fechar o diálogo descarta tudo. Para uma nota simulada virar real, o caminho é o formulário normal de lançamento.

### Vínculo com provas

Lançar a nota direto no formulário da prova (campo "Nota" + seletor de "Componente de nota") cria ou atualiza a `Grade` vinculada automaticamente. Apagar a nota no formulário da prova remove a `Grade` junto — os dois lados são tratados como uma coisa só. `Grade.examId` continua único: uma prova tem no máximo uma nota.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/grades/overview` | Boletim de todas as disciplinas em andamento (aceita `semesterId`) |
| GET | `/grades/subject/:id` | Boletim de uma disciplina, com projeção |
| GET | `/grades` | Lista de notas (aceita `subjectId`) |
| POST | `/grades` | Lança uma nota |
| PATCH | `/grades/:id` | Atualiza |
| DELETE | `/grades/:id` | Exclui |
| GET | `/subjects/:id/grade-configuration` | Configuração de notas da disciplina |
| PUT | `/subjects/:id/grade-configuration` | Substitui os componentes e a nota de aprovação |
| GET | `/semesters/:id/grade-configuration-template` | Modelo padrão do semestre (`null` se ainda não definido) |
| PUT | `/semesters/:id/grade-configuration-template` | Substitui o modelo padrão |

### Modelo de semestre (Etapa 18)

Duas lacunas que só apareceram com uso real, mais um ajuste no peso das provas.

**Semestre novo já nasce com o modelo.** `semesterService.create` copia o **modelo pessoal** (o mesmo criado no primeiro login: N1/3, N2/4, N3/3) como template inicial, na mesma transação que cria o semestre — mesmo padrão de `subjectRepository.createWithGradeConfiguration`. Antes, cada período começava vazio e os componentes eram reconfigurados na mão, com o modelo pessoal parado ali do lado. Um modelo pessoal **sem componentes** não vira template: `findByTemplateSemester` passaria a encontrar uma configuração vazia e disciplinas novas nasceriam sem componente nenhum, em vez de herdarem o modelo pessoal.

**Propagar o modelo virou um passo explícito.** A garantia da Etapa 17 continua de pé — `GradeConfiguration` é copiada, nunca compartilhada, e salvar o modelo não altera disciplina nenhuma. O que mudou é que agora existe um caminho para propagar, com confirmação:

1. `GET /semesters/:id/grade-configuration-template/propagation-preview` compara o modelo com a configuração de cada disciplina do período e devolve a diferença: componente ausente na disciplina, peso divergente, `passingGrade` divergente. Disciplinas já alinhadas ficam fora da resposta.
2. Salvar o modelo abre a confirmação com as disciplinas afetadas marcadas por padrão, destacando quando o componente já tem nota lançada — ali mudar o peso recalcula uma média que a pessoa já viu na tela.
3. `POST .../propagate` aplica só nas disciplinas enviadas.

A fusão é sempre **aditiva** (`apps/api/src/utils/grade-template-merge.ts`, função pura): componente do modelo ausente na disciplina é criado; presente nos dois tem peso e ordem sincronizados; **componente que só a disciplina tem nunca é removido**. Remoção continua manual, na configuração da própria disciplina, onde existe o bloqueio de "já tem nota lançada" — um modelo jamais apaga nota de ninguém. Componentes são casados por **nome** (ignorando caixa e espaços), já que cada cópia tem ids próprios.

A prévia e a gravação usam a mesma função: se fossem duas implementações, a confirmação acabaria mentindo sobre o que seria gravado. Um teste garante que, depois de fundir, não sobra diferença nenhuma.

Os modelos saíram do formulário de disciplina — onde o atalho "Configurar modelo de notas de [semestre]" passava a impressão de estar editando aquela disciplina — para um menu **Modelos de notas** na tela de Disciplinas, com o modelo padrão e um item por semestre. O link contextual continua no formulário, como conveniência.

### O peso da prova vem do componente

`Exam.weight` deixou de existir. O peso de uma prova é o do **componente** que ela representa, derivado na leitura — editar o peso do N1 vale imediatamente para todas as provas dele, sem cópias desatualizadas por aí. Prova sem componente tem `weight: null` (não entra na média, e exibir "peso 1" sugeriria o contrário). A coluna já era decorativa desde a Etapa 17, quando o peso migrou para `GradeComponent`; a migração `20260810200000_exam_weight_from_component` a remove sem backfill — não há como traduzir peso de prova em peso de componente, já que várias provas podem apontar para o mesmo.

### Nota parcial conta no cálculo

`isFinal: false` ("ainda não é a nota final") significa que **mais pontos podem somar** naquele componente — não que os pontos já lançados não valham. O cálculo descartava o valor inteiro, o que tornava a projeção inútil justamente para quem usava o recurso: com N1 5 (peso 3) e N2 5 (peso 4, em aberto), o sistema pedia 6,4 "na N2 e N3", ignorando os 20 pontos já garantidos da N2. O correto é 8,33 na N3 — `(6 × 10 − 35) ÷ 3`.

Agora `pendingComponents` são só os componentes **sem nenhum lançamento**. Como um componente pode receber vários lançamentos, `toGradeLikes` **agrupa por componente** antes de ponderar: os valores somam (normalizados para 0–10) e o peso entra uma vez só. Sem o agrupamento, dois lançamentos no N2 de peso 4 contariam peso 8 e o componente valeria o dobro do configurado.

### Data digitada é a data salva

O JavaScript lê `"2026-10-05"` como meia-noite **UTC** e `"2026-10-05T00:00"` como meia-noite **local**. Como o formulário de prova usa um seletor de data (sem hora), uma prova cadastrada para 05/10 era gravada às 00:00Z — 21h do dia 04 em Brasília — e aparecia um dia antes no calendário. `parseLocalDate` (em `packages/shared/src/common.ts`) acrescenta a hora explícita quando a string é só data, e é usado por todos os schemas com data. Strings que já trazem hora passam direto.

Registros gravados **antes** dessa correção continuam um dia adiantados até serem salvos de novo — o dado antigo não é reescrito automaticamente.

### Endpoints (Etapa 18)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/semesters/:id/grade-configuration-template/propagation-preview` | O que mudaria em cada disciplina do período |
| POST | `/semesters/:id/grade-configuration-template/propagate` | Aplica o modelo nas disciplinas escolhidas |

