# Testes

```bash
npm test          # execução única
npm run test:watch
```

**153 testes**, sobre as regras puras — repetição espaçada, gerador de cronograma, cálculo de notas, decisão de vínculo de login e os contratos Zod. São elas que concentram a lógica de negócio e, na prática, foi nelas que os bugs apareceram.

### O que os testes protegem

Cada bloco existe por causa de um bug real que aconteceu durante o desenvolvimento:

| Teste | Bug que ele impede de voltar |
| --- | --- |
| `contracts.test.ts` — defaults no PATCH | `.partial()` não remove `.default()`: editar a sala de uma prova zerava o peso dela; editar o rótulo de uma nota dividia o valor por dez; editar o título de uma atividade devolvia uma tarefa concluída para pendente |
| `contracts.test.ts` — `booleanQueryParam` | `Boolean("false")` é `true`: `?permanent=false` **apagava** uma disciplina que deveria só ser arquivada |
| `spaced-repetition.test.ts` — piso do ease factor | sem o piso de 1,3, um cartão errado muitas vezes ficaria preso repetindo todo dia para sempre |
| `schedule-generator.test.ts` — prazo e sobreposição | blocos agendados depois do próprio prazo, ou em cima de compromissos existentes |
| `grade-template-merge.test.ts` — fusão aditiva | propagar o modelo de um semestre apagando um componente que só a disciplina tinha — e, com ele, a nota lançada nesse componente |
| `grade-calculator.test.ts` — agrupamento por componente | dois lançamentos no mesmo componente contavam o peso duas vezes; e uma nota parcial (`isFinal: false`) era descartada inteira da projeção |
| `contracts.test.ts` — data local | `"2026-10-05"` lido como meia-noite UTC: prova cadastrada para 05/10 aparecia como 04/10 no calendário |
| `notification-rules.test.ts` — dia de calendário | comparar prazos por 24 horas corridas fazia a atividade que vence hoje às 9h aparecer como atrasada às 14h |
| `notification-rules.test.ts` — escalonamento | estados diferentes precisam gerar conteúdo diferente (senão o texto não atualiza) e o mesmo estado precisa gerar conteúdo idêntico (senão a notificação dispensada volta ao sino) |
| `google-link-resolution.test.ts` — vínculo automático (R1) | um auto-link ingênuo entre Google e uma conta por senha permitiria sequestrar um e-mail ocupado por terceiro antes da vítima real chegar — a decisão que evita isso é pura e testada à parte da chamada real ao Google |

> **Ao rodar verificações manuais em sequência, atenção ao rate limit.** A API
> permite 300 requisições por 15 minutos por IP (`RATE_LIMIT_MAX`). Um roteiro
> longo de verificação contra o servidor local esbarra nesse teto e passa a
> receber `429` — o limitador funcionando como projetado, não uma falha. Espere
> a janela ou eleve o valor **apenas no ambiente de teste**.

Os testes foram **validados por mutação**: cada regra foi quebrada de propósito e confirmou-se que o teste correspondente falha. Um teste que passa com a regra quebrada não protege nada.

O fuso é fixado em `America/Sao_Paulo` na configuração do Vitest: várias regras dependem de "meia-noite local", e sem isso a suíte passaria na máquina de quem escreveu e falharia numa esteira rodando em UTC.

### O que NÃO está aqui, e por quê

Testes que exigem banco ficam fora da suíte: eles precisam de um Postgres dedicado com carga e limpeza a cada execução, o que é uma decisão de infraestrutura separada. Durante o desenvolvimento, cada etapa foi verificada contra o servidor real e num navegador real (Chromium via Playwright) — cobrindo endpoints, fluxos de tela, responsividade em 320/375/768px e ausência de erros de JavaScript. Esses roteiros não estão versionados; formalizá-los como suíte de integração é o próximo passo natural do projeto.

