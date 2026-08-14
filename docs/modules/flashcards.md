# Flashcards

Um **baralho** (`Deck`) agrupa cartões por assunto e pode pertencer a uma disciplina. Cada **cartão** carrega o próprio estado de repetição espaçada.

### Por que repetição espaçada, e não uma lista

Mostrar todos os cartões do baralho a cada estudo faz o aluno gastar tempo no que já sabe — exatamente o que flashcards deveriam evitar. O agendamento usa **SM-2** (Piotr Wozniak, 1987; a base do Anki), guardando três valores por cartão:

| Campo | Papel |
| --- | --- |
| `easeFactor` | Quão "fácil" o cartão é. Começa em 2,5 e nunca cai abaixo de **1,3** |
| `intervalDays` | Dias até a próxima revisão |
| `repetitions` | Acertos consecutivos. Zera a cada erro |

Acertando sempre, os intervalos crescem: **1 → 6 → 15 → 38 → 95 → 238 dias**. Errar zera a sequência, devolve o intervalo para 1 dia e reduz permanentemente o `easeFactor` — o cartão volta a aparecer com mais frequência mesmo depois de o aluno recomeçar a acertá-lo.

O piso de 1,3 no `easeFactor` existe para um caso concreto: sem ele, um cartão errado muitas vezes teria o fator empurrado para perto de zero e ficaria preso repetindo todo dia para sempre.

O cálculo vive em `utils/spaced-repetition.ts` como **função pura**, com o "agora" injetado. Isso permite testar o agendamento sem banco e sem servidor, e impede a regra de vazar para o repositório.

### A avaliação que o aluno vê

Quatro botões, com a consequência de cada um à vista antes do clique:

| Botão | `quality` | Efeito |
| --- | --- | --- |
| Errei | 0 | Volta amanhã, sequência zerada, registra *lapse* |
| Difícil | 3 | Avança, mas o cartão fica mais "caro" |
| Bom | 4 | Avança mantendo o ritmo |
| Fácil | 5 | Avança e fica mais "barato" |

Sem o intervalo previsto no botão, "Bom" e "Fácil" viram escolha arbitrária. A previsão vem do servidor junto com o cartão — duplicar o SM-2 no cliente só para escrever "6 dias" criaria duas implementações que divergiriam na primeira mudança.

Atalhos de teclado: **espaço** revela a resposta, **1–4** avaliam. Estudar com o mouse trava o ritmo.

### O servidor não guarda sessão

Cada avaliação é um `POST` independente. Fechar a aba no meio não perde nada nem deixa sessão pendurada — o progresso já está nos cartões. Em compensação, a tela **congela a fila** ao iniciar: reagir a mudanças da query no meio do estudo trocaria o cartão sob os pés do usuário.

### Log de revisões

`FlashcardReview` é append-only e grava cada avaliação junto com o novo estado do cartão, **na mesma transação**. O estado no cartão responde "o que revisar agora"; ele não responde "quanto estudei nesta semana" — e o histórico só existe se for gravado no momento em que acontece. É dele que saem a sequência de dias e a taxa de retenção.

### Ordem da fila

Vencidos há mais tempo primeiro; novos por último. Mostrar cartões inéditos antes dos atrasados infla a carga futura: o aluno acumula dívida enquanto conhece material novo.

Um cartão é considerado **dominado** a partir de 21 dias de intervalo — antes disso o SM-2 ainda está em aprendizado, e chamá-lo de dominado daria uma sensação falsa de progresso.

### Importação em lote

Digitar cartão a cartão é o maior atrito de um app de flashcards. O diálogo de importação aceita uma linha por cartão, com frente e verso separados por **tabulação**, `;` ou ` - `. A tabulação vem primeiro porque é o que sai ao copiar de uma planilha. Linhas sem separador são apontadas em vez de silenciosamente ignoradas.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/decks` | Lista baralhos com contagens |
| POST | `/decks` | Cria |
| GET | `/decks/:id` | Detalhe |
| PATCH | `/decks/:id` | Atualiza |
| POST | `/decks/:id/archive` | Arquiva (tira da fila, preserva os cartões) |
| POST | `/decks/:id/unarchive` | Reativa |
| DELETE | `/decks/:id` | Exclui (cartões em cascata) |
| GET | `/decks/:id/cards` | Cartões do baralho (`view`, `search`) |
| POST | `/flashcards` | Cria um cartão |
| POST | `/flashcards/bulk` | Cria vários |
| PATCH | `/flashcards/:id` | Edita o texto (não afeta o agendamento) |
| DELETE | `/flashcards/:id` | Exclui |
| GET | `/flashcards/queue` | Fila de estudo |
| POST | `/flashcards/:id/review` | Registra a avaliação e reagenda |
| GET | `/flashcards/stats` | Pendentes, sequência e retenção |

