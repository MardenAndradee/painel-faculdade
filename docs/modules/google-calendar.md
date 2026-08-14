# Google Calendar

Importa compromissos da sua agenda para o calendário do Painel — ao lado de provas e entregas.

### Somente leitura, por escolha

O escopo é apenas `calendar.readonly`. A versão inicial do código pedia também `calendar.events`, que dá **permissão de escrita** na agenda pessoal; foi removido. Pedir permissão que não se usa é má prática e reduz a confiança na tela de consentimento.

Consequência: o Painel **não exporta** provas e entregas para o Google. Se quiser isso depois, é uma decisão consciente de ampliar o escopo.

### `singleEvents=true` — não é detalhe

Sem essa flag, um evento recorrente ("aula toda terça") chega como **uma** entrada com regra de recorrência, e apareceria uma única vez no calendário. Com ela, o Google expande em instâncias individuais, cada uma com id próprio (`abc_20260815T120000Z`) — o que também resolve o dedupe.

### Evento apagado no Google some daqui

Só criar e atualizar deixaria eventos fantasma. A sincronização compara o que existe importado na janela com o que veio na resposta e **remove a diferença**. Cancelar um compromisso no Google tem efeito imediato aqui.

### Escopo da importação

| Aspecto | Decisão |
| --- | --- |
| Calendários | Apenas o **principal** — importar feriados, aniversários e assinaturas encheria a tela |
| Janela | 30 dias atrás até 180 à frente |
| Eventos do Painel (`MANUAL`) | **Nunca** tocados pela sincronização |
| Vínculo com disciplina | Preservado (é do Painel, não do Google) |
| Título, horário, local | Sempre sobrescritos (são do Google) |

### Eventos importados são somente leitura

Recebem ícone próprio no calendário e **não abrem o formulário de edição** — a próxima importação sobrescreveria a alteração. Clicar mostra um aviso indicando editar na agenda do Google.

### Desconectar remove os importados

Diferente do Classroom: sem a integração ativa, os eventos nunca mais seriam atualizados, e cópias congeladas da agenda confundiriam mais do que ajudariam. Eventos criados no Painel permanecem.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/integrations/calendar/connect` | URL de autorização (escopo readonly) |
| POST | `/integrations/calendar/sync` | Importa e devolve o relatório |
| DELETE | `/integrations/calendar` | Desconecta e remove os importados |

