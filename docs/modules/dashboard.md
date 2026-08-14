# Dashboard

`GET /dashboard/summary` devolve **tudo** que a primeira tela precisa numa resposta só. Seis chamadas separadas significariam seis idas ao servidor antes de qualquer coisa aparecer; no servidor, as consultas independentes rodam em paralelo com `Promise.all`.

### Cálculo das médias

| Nível | Método | Motivo |
| --- | --- | --- |
| Por disciplina | Média **ponderada** pelos pesos das avaliações | Uma P1 peso 2 vale o dobro de um trabalho peso 1 |
| Geral | Média **simples** das médias por disciplina | Sem isso, uma matéria com dez listas dominaria uma com duas provas |

As notas são normalizadas para a escala 0–10 antes da ponderação (uma prova de 100 pontos precisa ser comparável a um trabalho de 10). Disciplinas **sem nota lançada ficam de fora** do cálculo — ausência de avaliação não é média zero.

### Layout

- **Sidebar**: `Sheet` deslizante no mobile, coluna fixa a partir de `lg`. Mesma lista de links, definida uma vez em `lib/navigation.ts`.
- **Breadcrumbs**: derivados do pathname — telas novas entram automaticamente ao serem registradas na navegação.
- **Dark mode**: `next-themes` com `attribute="class"`, alimentando o `@custom-variant dark` do `globals.css`. Um script inline roda antes da pintura, evitando flash branco.
- **Skeletons** reproduzem o formato do conteúdo real, para o layout não saltar quando os dados chegam.

### Busca global e central de notificações (Etapa 19)

Duas peças que o cabeçalho não tinha: uma paleta de comando e um sino. Nada de sidebar, cards, cores, tipografia ou espaçamento foi tocado — a etapa soma dois itens ao cabeçalho e nenhuma cor nova a `globals.css`.

**Busca global (⌘K / Ctrl+K)**

`GET /search?q=` agrega as cinco fontes em paralelo (mesmo `Promise.all` do `dashboard.service`), até 5 resultados por categoria. O acesso a dados é um repositório próprio, e não os cinco de listagem: a paleta precisa de uma projeção única e mínima (título, contexto, cor), não de cinco formatos de item de lista com contagens, paginação e relações que ela nunca exibe — trazer tudo isso para descartar 90% seria trabalho de banco jogado fora a cada tecla.

O resultado **não carrega a URL de destino**. Montar `/disciplinas/:id` é conhecimento da estrutura de rotas desta aplicação (`apps/web/lib/entity-routes.ts`), não do contrato — a mesma busca serviria a um app com outra navegação sem mudar uma linha do backend.

Só disciplina tem tela de detalhe. Para atividades, provas e materiais a URL leva o **termo** (`/atividades?busca=Lista 3`), e a tela abre já filtrada nele: o item escolhido fica na primeira página em vez de perdido na página 4, e o campo de busca preenchido explica por que a lista está curta. Essas telas também forçam o recorte "todas" — uma atividade concluída não apareceria em "pendentes", e a pessoa cairia numa lista vazia logo depois de ver o item no resultado. O calendário fica de fora: ele filtra por intervalo de datas, não por texto.

O termo é destacado com `<mark>` por **fatiamento de string**, nunca `innerHTML` — o termo vem do que a pessoa digitou, e injetá-lo como HTML seria XSS a um passo. A filtragem interna do `cmdk` fica desligada (`shouldFilter={false}`): quem filtra é o servidor, e deixar a biblioteca refiltrar esconderia resultados legítimos que ela não considera parecidos o bastante.

O atalho `⌘K`/`Ctrl+K` é o primeiro *listener* de teclado global do projeto, registrado no `AppShell` pelo mesmo motivo do `useAutoSync`: o shell monta uma vez e sobrevive à navegação.

**Central de notificações**

O modelo `Notification` já existia no schema desde uma etapa anterior, sem repositório, serviço, rota nem tela. A migração `20260810230000_notification_priority` é o que faltava, e é inteiramente **aditiva**: novo enum `NotificationPriority` (🔴 `URGENT`, 🟡 `ATTENTION`, 🔵 `INFO`, 🟢 `DONE`), a coluna com default, o valor `ASSIGNMENT_CREATED` no enum de tipo e um índice por entidade.

Prioridade é separada do tipo de propósito: a mesma atividade vira `ATTENTION` quando vence amanhã e `URGENT` quando vence hoje, sem trocar de tipo.

Geração **sob demanda, não por cron** — o projeto não tem worker nem fila, e um cron seria infraestrutura nova para uma varredura de milissegundos. `GET /notifications` e `GET /notifications/unread-count` rodam a varredura antes de responder; as regras que decidem o que vira notificação são uma função pura com o "agora" injetado (`apps/api/src/utils/notification-rules.ts`), como `spaced-repetition` e `schedule-generator`.

| Fonte | Quando | Prioridade |
| --- | --- | --- |
| Atividade | atrasada (até 30 dias) | 🔴 urgente |
| Atividade | vence hoje | 🔴 urgente |
| Atividade | vence amanhã | 🟡 atenção |
| Atividade | vence em 2–3 dias | 🔵 informativo |
| Prova | hoje ou amanhã | 🔴 urgente |
| Prova | em 2–3 dias | 🟡 atenção |
| Prova | em 4–7 dias | 🔵 informativo |

A varredura **reconcilia**, não acumula: o que deve existir e não existe é criado; o que mudou de estado atualiza a mesma linha (a atividade que ontem "vencia amanhã" hoje "vence hoje" continua sendo uma notificação, não duas); o que perdeu o motivo — atividade concluída, prova que passou — é apagado.

> **A notificação lida também conta na comparação.** A primeira versão só olhava as não lidas, e a varredura recriava, segundos depois, exatamente a notificação que a pessoa acabara de dispensar — o indicador voltava sozinho ao mesmo número. Hoje uma notificação já lida e **idêntica** ao que a varredura produziria bloqueia a recriação; só um estado que de fato evoluiu ("vence amanhã" → "vence hoje") gera um aviso novo. O bug foi encontrado pela verificação contra a API rodando, não pelos testes de unidade.

A reconciliação mexe apenas nas **não lidas** e nos tipos que a varredura administra (`SCANNED_TYPES`): notificação lida é histórico do que a pessoa viu, e a de "nova atividade do Classroom" tem `entityType: ASSIGNMENT` igual às de prazo, mas não é gerada ali.

"Nova atividade adicionada" nasce da sincronização do Classroom — não de um cadastro manual, já que quem cadastra sabe que acabou de fazer isso. Até 5 atividades, uma notificação por atividade, para que o clique leve ao item; acima disso vira um resumo, porque a primeira sincronização importa o semestre inteiro e quarenta linhas no sino são ruído, não informação. Falhar ao notificar não derruba uma sincronização que já deu certo: as atividades já estão salvas.

"Nova prova adicionada" ficou **fora de escopo**: o Classroom não sincroniza provas, então não há fonte automática. Lembretes de prova por proximidade existem (tabela acima) — são outra coisa.

### Endpoints (Etapa 19)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/search` | Busca agregada (disciplinas, atividades, provas, eventos, materiais) |
| GET | `/notifications` | Lista, gerando as pendentes antes de responder |
| GET | `/notifications/unread-count` | Contagem para o indicador do sino |
| PATCH | `/notifications/:id/read` | Marca uma notificação como lida |
| POST | `/notifications/read-all` | Marca todas como lidas |

