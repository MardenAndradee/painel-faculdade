# Histórico

O boletim (Etapa 10) responde "como estou indo agora". O histórico responde "o que já ficou para trás" — e essas duas perguntas exigem números diferentes.

### Encerrar um semestre congela as médias

Enquanto o semestre está aberto, a média de uma disciplina é **derivada**: recalculada a cada nota lançada. Isso é o certo para o período corrente e errado para o histórico — corrigir hoje o peso de uma prova de dois anos atrás não pode mudar um histórico já consolidado.

`POST /semesters/:id/close` resolve isso materializando o resultado:

1. calcula a média ponderada de cada disciplina do período;
2. grava em `Subject.finalGrade` e define `status` como `APPROVED` ou `FAILED` comparando com o `passingGrade` da disciplina;
3. marca o semestre como `FINISHED`.

A partir daí a tela lê `finalGrade` (rotulado **final**) em vez de recalcular. Editar uma nota antiga passa a não afetar o histórico.

> **Semestre automático (Etapa 31).** `Semester` não é mais criado à mão: nasce sozinho, calculado
> pela data de hoje (`getCurrentSemesterKey`, em `packages/shared`), no primeiro login ou sob
> demanda na primeira leitura que precisar dele — nunca fica vazio. "Semestre atual" deixou de
> ser um campo gravado (`isCurrent`); é sempre o que bate com o calendário, calculado ao vivo
> (`isCurrentSemester`). Por isso "Encerrar" não desmarca mais nada — só congela as notas (passo
> 3 acima). O avanço para o próximo semestre é automático, pela passagem do calendário, não uma
> ação manual. Consequência aceita: um semestre pode aparecer como "Atual" e "Encerrado" ao mesmo
> tempo por um período — não é um bug.

Antes de confirmar, `GET /semesters/:id/close-preview` devolve exatamente o que será gravado em cada disciplina — inclusive quantas ficarão sem média por não terem notas lançadas. A operação é reversível: `POST /semesters/:id/reopen` limpa `finalGrade`, devolve o status para `IN_PROGRESS` e as médias voltam a ser calculadas.

### CR ponderado por créditos

O dashboard mostra a média **simples** entre as disciplinas em andamento. O CR do histórico é diferente em dois pontos, porque imita o que a faculdade calcula:

- pondera por **créditos** — uma disciplina de 6 créditos pesa três vezes mais que uma de 2;
- conta apenas as disciplinas **aprovadas e já consolidadas**.

```
CR = Σ(finalGrade × créditos) ÷ Σ(créditos)   — apenas APPROVED
```

Com os dados do seed: `(8,7 × 4 + 7,4 × 4) ÷ 8 = 8,1`. A disciplina reprovada (5,2) entra na contagem de créditos cursados, mas não no CR.

### Excluir um semestre não exclui disciplinas

`semesterId` é opcional em `Subject` e usa `onDelete: SetNull`. Apagar um período deixa as disciplinas sem vínculo em vez de destruir o histórico de notas — elas aparecem na seção "Sem período atribuído", prontas para serem reatribuídas.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/semesters` | Lista os períodos com contagens (garante o atual antes de ler) |
| GET | `/semesters/history` | Histórico agrupado + CR e créditos (idem) |
| PATCH | `/semesters/:id` | Renomeia — ano, período e datas não são editáveis (Etapa 31) |
| DELETE | `/semesters/:id` | Exclui, preservando as disciplinas |
| GET | `/semesters/:id/close-preview` | Prévia da consolidação |
| POST | `/semesters/:id/close` | Encerra e congela as médias |
| POST | `/semesters/:id/reopen` | Reabre e descongela |

Não existe mais `POST /semesters`: a criação é sempre interna (`semesterService.ensure`), nunca
pela API pública.

