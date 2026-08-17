# Turma: virada de semestre automática

> **Só análise e plano — nada foi implementado.** Nenhum arquivo alterado,
> nenhuma migration criada. As três decisões de desenho já foram respondidas
> (seção "Decisões"), incluindo a Etapa 32.3 (confirmada, com o texto bem
> discreto). A implementação começa na Etapa 32.1.

## Problema

"Finalizar semestre" (Etapa 30.5) é hoje uma ação 100% manual do dono, sem
nenhuma validação contra o calendário: `nextSemesterKey` só incrementa o que
a turma já tem (`term 1 → term 2`, `term 2 → term 1, year+1`), nunca olha
para a data de hoje. Isso abre uma brecha real — testada e confirmada nesta
conversa: um dono pode finalizar em qualquer dia do ano, inclusive várias
vezes seguidas, adiantando a turma inteira (e o semestre pessoal de cada
membro ativo, via o mesmo *fan-out* que já existe) em relação ao calendário
real, sem nenhum aviso.

O aluno independente já não tem esse problema — a Etapa 31 tirou completamente
a criação manual de `Semester`, substituindo por "nasce sozinho, calculado
pela data de hoje". Este plano aplica a mesma decisão à Turma: a virada deixa
de ser uma ação que o dono pode errar, e passa a ser um fato do calendário,
resolvido sozinho na primeira leitura que precisar dele — exatamente o
princípio "sob demanda" que este projeto já usa (bootstrap de usuário,
central de notificações, semestre pessoal) para evitar depender de cron ou
worker sempre que dá.

## Mecânica atual (o que este plano substitui)

```
POST /classes/:id/finish-semester-preview   → GET, só o dono, mostra os números
POST /classes/:id/finish-semester           → POST, só o dono, executa
```

`finishSemester` (`class.service.ts`): calcula o próximo `(year, term)` a
partir do que a turma JÁ TEM (nunca da data de hoje), resolve-ou-cria o
semestre pessoal de cada membro ativo pro novo ciclo (mesmo `fan-out` que
`join` usa), atualiza `Class.semesterId`/`Class.period += 1`. `ClassSubject`/
`ClassPost` do ciclo antigo mantêm seu `semesterId`/`period` (imutáveis) e
saem da visão principal para a aba Histórico.

## Mecânica proposta

Um motor novo, `ensureCurrentCycle(classId)`, chamado **antes** de qualquer
leitura/escrita que dependa do ciclo atual da turma:

```
ensureCurrentCycle(classId)
  target = getCurrentSemesterKey(hoje)          -- mesma funcao do aluno independente
  se target <= semestre atual da turma → nada a fazer (caso comum, leitura barata)
  senao:
    elapsedTerms = termsBetween(atual, target)  -- funcao pura nova
    fan-out pra cada membro ativo (reaproveita a logica que "Finalizar" ja tem)
    Class.semesterId = semestre(target) do dono
    Class.period += elapsedTerms                -- pode ser mais que 1 (Decisão #2)
```

`ClassSubject`/`ClassPost` continuam exatamente como hoje — imutáveis,
tagueados no momento da criação, migrando para Histórico só por deixarem de
bater com o `semesterId` atual da turma. Nenhuma mudança na aba Histórico.

**Onde `ensureCurrentCycle` é chamado** (para cobrir todo caminho que lê a
turma, não só a tela principal):

| Ponto | Por quê |
| --- | --- |
| `classGuard` (middleware) | Escolho único de toda rota `/classes/:id/...` — cobre a esmagadora maioria dos casos numa linha só |
| `classMembershipService.join` | Entrada por convite não passa pelo `classGuard` (é por token, não por `:id`) — sem isso, alguém entrando numa turma parada herdaria o semestre desatualizado |
| `classService.previewInvite` | A prévia do convite (antes de aceitar) deve refletir o ciclo real, não um desatualizado |
| `classController.list` | Lista as turmas do usuário (no máximo uma, por causa do limite da Etapa 30.1) — barato, garante que o period/semestre mostrado já está em dia mesmo sem visitar o detalhe |

O efeito colateral (mover conteúdo pra Histórico) passa a poder ser disparado
pela leitura de **qualquer** membro ativo, não só do dono — aceitável, porque
deixou de ser uma decisão de alguém: é um fato do calendário, mesmo
princípio já usado no bootstrap de usuário novo.

**Corrida entre requisições simultâneas.** Duas pessoas abrindo a turma no
mesmo instante da virada não podem avançar o ciclo duas vezes. O `update`
final é condicional (`WHERE semesterId = <antigo>`) — quem chegar primeiro
avança; o segundo vê zero linhas afetadas, relê o estado (já avançado) e
segue sem duplicar.

## Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | O botão "Finalizar semestre" continua existindo? | **Não, remove por completo.** Mesma filosofia da Etapa 31 — sem ação manual, sem brecha. `POST/GET .../finish-semester*` saem do backend e do frontend. |
| 2 | Turma parada por vários semestres, o period avança de quanto? | **Pula direto pro semestre certo, period soma tudo de uma vez** (`elapsedTerms`, pode ser >1). Evita gerar ciclos quase vazios no Histórico no meio do caminho - mesmo princípio do aluno independente ("atual" é sempre o que bate com hoje, nunca uma fila de passos perdidos). |
| 3 | Etapa 32.3 (texto informativo da próxima virada) entra no escopo? | **Sim, com uma ressalva: tem que ficar bem discreto** - texto pequeno, sem destaque visual, nunca parecendo um botão ou uma ação disponível. |

## Plano por etapas

### Etapa 32.1 — Backend: motor de avanço automático

**Objetivo.** `ensureCurrentCycle` funcionando e plugado em todo ponto de
entrada relevante, sem ainda remover a ação manual (convivem por uma etapa,
pra isolar risco).

**Banco.** Nenhuma migration — reaproveita `Class.semesterId`/`Class.period`
que já existem.

**Backend.**
- `termsBetween(from: SemesterKey, to: SemesterKey): number` — função pura
  nova em `packages/shared/src/semester-period.ts`, ao lado de
  `getCurrentSemesterKey`/`nextSemesterKey`.
- Extrai o *fan-out* que `finishSemester` já tem pra uma função interna
  reaproveitável (`advanceCycle`), chamada tanto pelo endpoint manual (ainda
  vivo nesta etapa) quanto pelo novo `ensureCurrentCycle`.
- `ensureCurrentCycle(classId)`: no-op quando já em dia; senão calcula
  `elapsedTerms`, roda `advanceCycle`, grava com `update` condicional
  (proteção contra corrida).
- Plugado nos 4 pontos da tabela acima.

**Riscos.** R1 (corrida entre requisições simultâneas) — mitigado pelo
`update` condicional. R2 (`join`/`previewInvite` de convite antigo lendo
semestre desatualizado) — mitigado por rodar `ensureCurrentCycle` nesses
pontos também, não só no `classGuard`.

**Testes.** Unidade de `termsBetween` (mesmo termo, 1 de diferença, vários
anos), com mutação. Integração: turma em dia (no-op, nenhuma escrita
disparada); turma 1 termo atrasada (avança exatamente 1, fan-out correto
pra cada membro ativo); turma vários termos atrasada (pula direto pro
semestre certo, period soma o delta certo, sem ciclo intermediário no
Histórico); duas requisições simultâneas contra a mesma turma atrasada (só
uma avança de verdade, a outra não duplica).

**Aceite.** Abrir uma turma atrasada em qualquer um dos 4 pontos de entrada
já mostra o ciclo certo, sem ação de ninguém. Nenhuma regressão nos
cenários já cobertos por QA anterior (isolamento pós-virada, bloqueio de
reativação da Etapa 30/31).

### Etapa 32.2 — Remove a ação manual

**Objetivo.** Fechar a brecha por completo — sem caminho manual sobrando em
lugar nenhum.

**Backend.** Remove `POST /classes/:id/finish-semester` e
`GET /classes/:id/finish-semester-preview` (rota, controller, método do
service). `advanceCycle` (extraída na 32.1) continua existindo, só que
agora com uma única chamadora: `ensureCurrentCycle`.

**Frontend.** Remove o botão "Finalizar semestre" e o diálogo de
confirmação/prévia da tela da turma. Remove os hooks/serviços
correspondentes (`useFinishSemesterPreview`/`useFinishSemester` ou nomes
equivalentes) e suas chamadas.

**Documentação.** `docs/modules/turmas.md`: a seção que hoje descreve
"Finalizar semestre" como ação do dono passa a descrever a virada
automática; roadmap ganha a entrada desta etapa.

**Riscos.** R4 (algum fluxo do frontend que eu não previ dependia do
endpoint manual) — mitigado revisando todo uso do hook antes de remover.

**Testes.** As duas rotas antigas retornam 404. Roteiro manual: tela da
turma não mostra mais o botão; Histórico e o resto da tela continuam
funcionando exatamente como antes.

**Aceite.** Nenhum caminho no app (UI ou API) consegue mais forçar uma
virada fora do calendário real.

### Etapa 32.3 — Transparência da próxima virada (confirmada, bem discreta)

**Objetivo.** Sem ação nenhuma pra clicar, mostrar ao dono quando a próxima
virada automática vai acontecer, pra não parecer que "sumiu" o controle -
mas sem chamar atenção: é uma informação de bastidor, nunca um convite pra
interagir.

**Backend.** Endpoint leve e só-leitura (ex. `GET /classes/:id/next-cycle`)
devolvendo a próxima data de corte (`01/07` ou `01/01`, a que vier primeiro)
e o `period` que ela vai assumir — sem gravar nada.

**Frontend.** Texto pequeno e discreto perto do período/semestre na tela da
turma ("Próxima virada automática: 01/07/2026") - tamanho de legenda,
cor `text-muted-foreground` (mesmo padrão de metadado secundário já usado no
resto do app), sem ícone de destaque, sem borda, sem cara de botão, sem
`Tooltip`/`Badge` chamativo. Visível só pro dono (é informação de gestão da
turma, não algo que os membros comuns precisem ver toda hora).

**Aceite.** A informação existe e é encontrável pra quem procura, mas não
compete visualmente com nada da tela - passa despercebida por quem só quer
ver as disciplinas/publicações do período atual.

## Testes de regressão obrigatórios (herdados do QA já feito)

Antes de dar a etapa por concluída, repetir os cenários já validados
manualmente nesta conversa, agora disparados por avanço automático (mock de
`now`) em vez de `POST /finish-semester` manual:

- quem entra na turma **depois** da virada automática não recebe
  disciplina/vínculo do ciclo já superado (mesmo bug que foi corrigido pro
  fluxo manual);
- reativar uma participação antiga continua bloqueada corretamente se a
  pessoa está ativa em outra turma;
- limite de uma turma ativa por usuário continua intacto;
- conteúdo do ciclo anterior nunca é apagado, só sai da aba principal.

## Documentação

Ao concluir, atualizar `docs/modules/turmas.md` (seção "Turma ↔ Semestre")
removendo a descrição da ação manual e explicando o motor automático; marcar
a etapa como ✅ em `docs/roadmap.md`; mover este arquivo de `planning/` (ou
apagá-lo, já fundido) seguindo a convenção do projeto.
