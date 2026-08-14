# Calendário

### Uma agregação, não uma cópia

A agenda junta **eventos manuais**, **provas** e **entregas** (pelo prazo) num formato único. Provas e atividades **não são copiadas** para a tabela de eventos — são agregadas em tempo de consulta. Consequência prática: editar uma prova reflete no calendário imediatamente, sem sincronização nem risco de dessincronizar.

A agregação vive em `calendar.service` e é consumida **também pelo dashboard** — antes ele tinha a própria cópia da lógica.

Cada item recebe `key` prefixada (`exam:abc`, `event:abc`) porque ids se repetem entre tabelas diferentes.

### Visões sem grade de horas

O padrão de mercado usa uma linha por hora na visão de semana. **Não foi adotado aqui**: exige altura fixa por faixa, fica ilegível abaixo de 400px, e a maior parte dos itens são entregas com hora simbólica (23h59). As três visões usam listas cronológicas:

| Visão | Layout |
| --- | --- |
| Mês | Grade 7×6; até 3 itens por célula, com "+N itens" |
| Semana | 7 colunas no desktop, empilhadas no celular |
| Dia | Lista cronológica com horário, local e disciplina |

Itens que cobrem vários dias aparecem em **cada** dia do intervalo.

### Fuso horário

O intervalo é calculado no fuso do **navegador** — "semana de 3 a 9 de agosto" depende de onde o usuário está. O cliente envia ISO absoluto; o servidor só filtra. Intervalos acima de 400 dias são recusados.

### O que é editável no calendário

Só eventos próprios. Clicar numa prova ou entrega **não** abre o formulário de evento — elas têm suas próprias telas, com campos que não cabem ali.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/calendar` | Agenda agregada (`from`, `to`, `includeCompleted`) |
| POST | `/calendar/events` | Cria evento próprio |
| GET | `/calendar/events/:id` | Detalhes do evento |
| PATCH | `/calendar/events/:id` | Atualiza (revalida datas contra o valor salvo) |
| DELETE | `/calendar/events/:id` | Exclui |

