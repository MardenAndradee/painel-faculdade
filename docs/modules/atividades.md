# Atividades

Atividades manuais e importadas do Classroom são a **mesma entidade**, distinguidas por `source`. Aparecem juntas nas mesmas listas, filtros e no dashboard.

### Recortes prontos (`view`)

"Atrasada" é `status ∈ {pendente, em andamento} AND dueDate < agora`. Expor isso como filtros soltos faria cada tela remontar a regra — e chegar a definições diferentes. O servidor traduz:

| `view` | Significado |
| --- | --- |
| `todas` | Sem recorte |
| `pendentes` | Em aberto (pendente ou em andamento) |
| `concluidas` | Concluídas |
| `atrasadas` | Em aberto com prazo vencido |
| `hoje` | Em aberto vencendo hoje |
| `semana` | Em aberto vencendo nos próximos 7 dias |

Atividades **sem prazo** ficam fora dos recortes por data — "vence hoje" não deve listar algo que não vence nunca. Use `includeUndated=true` para incluí-las.

`GET /assignments/counts` devolve a contagem de cada recorte de uma vez, alimentando os contadores das abas.

### Ordenação por prioridade

O enum foi declarado `LOW, MEDIUM, HIGH, URGENT` e o Postgres ordena enums pela **ordem de declaração** — `ORDER BY priority DESC` já traz urgentes primeiro, sem nenhum `CASE`. Reordenar os valores do enum mudaria essa ordenação silenciosamente.

### Concluir

`PATCH /assignments/:id/toggle-complete` alterna o status e carimba `completedAt`. Rota própria porque é a ação mais frequente do sistema — um clique no checkbox não deve exigir que o cliente monte status e data.

No frontend a mudança é **otimista**: a interface responde antes da rede. Se a API falhar, o estado anterior é restaurado e um toast informa o erro.

Uma atividade concluída **nunca** é marcada como atrasada, mesmo com prazo vencido — ela já foi entregue.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/assignments` | Lista com `view`, `search`, `subjectId`, `priority`, `status`, `sortBy`, `order`, paginação |
| GET | `/assignments/counts` | Contagem por recorte (aceita `subjectId`) |
| POST | `/assignments` | Cria (sempre `source: MANUAL`) |
| GET | `/assignments/:id` | Detalhes |
| PATCH | `/assignments/:id` | Atualiza campos enviados |
| PATCH | `/assignments/:id/toggle-complete` | Conclui ou reabre |
| DELETE | `/assignments/:id` | Exclui |

