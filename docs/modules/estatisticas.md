# Estatísticas

Cinco recortes numa tela, alimentados por **um** endpoint agregado — cinco gráficos com endpoints próprios seriam cinco viagens de rede na primeira carga. As consultas rodam em paralelo no servidor.

### A forma vem antes da cor

Cada gráfico responde a uma pergunta, e a pergunta escolhe a forma:

| Pergunta | Forma | Por quê essa |
| --- | --- | --- |
| "Estou estudando?" | barra por dia | volume por dia, não medida contínua |
| "Onde estou mal?" | barra horizontal, **uma cor** | nomes longos pedem horizontal; a barra já codifica o valor |
| "Estou melhorando?" | linha, 2 séries | tendência ao longo dos semestres |
| "Como está minha entrega?" | barra empilhada | parte-do-todo; pizza com 4 fatias é ilegível |
| Números de destaque | *stat tiles* | um valor único não é um gráfico de uma barra |

O gráfico de média por disciplina usa **uma cor só**, apesar de cada disciplina ter a sua no resto do app: aqui o comprimento da barra já mostra o valor, e pintar cada uma de um tom gastaria o único canal livre repetindo informação que o gráfico já dá. A identidade fica no rótulo do eixo.

### A paleta foi validada por script, não escolhida no olho

Os tokens `--chart-1..3` passaram por um validador de paletas nos dois temas: faixa de luminosidade, piso de croma, separação sob daltonismo e contraste com a superfície.

```
claro  #2a78d6  #eb6834  #1baf7a   pior par (deuteranopia) ΔE 9.2
escuro #3987e5  #d95926  #199e70   pior par (deuteranopia) ΔE 9.4
```

O alvo é ΔE ≥ 8. **Trocar qualquer um desses hex exige rodar o validador de novo.** São três slots de propósito: um quarto colocaria amarelo e laranja na mesma tela, par que reprova nos pisos — e nenhum gráfico aqui precisa de mais de duas séries categóricas.

Os valores do tema escuro são passos próprios para a superfície escura, **não** uma inversão automática dos claros.

### Regras que a tela respeita

- **Nunca dois eixos Y.** Minutos estudados e cartões revisados têm escalas incomparáveis: dois gráficos. Um segundo eixo inventaria uma correlação a partir do alinhamento arbitrário das escalas.
- **Um filtro, acima de tudo.** Filtros dentro de cada card fariam o usuário comparar recortes diferentes sem perceber.
- **Toda série tem tabela equivalente**, alcançável por um botão. Um gráfico que só pode ser lido por cor e posição exclui quem usa leitor de tela e quem precisa do número exato.
- **Cores de status são reservadas.** A barra de situação das atividades usa os tokens semânticos (bom/atenção/crítico), nunca a paleta de séries — e cada segmento vem com ícone e rótulo, porque cor sozinha não pode carregar o significado.
- **Marcas finas, grade sólida e discreta**, rótulos diretos seletivos (nunca um número em cada ponto).
- **Sem salto de layout ao trocar o período**: o conteúdo anterior fica com opacidade reduzida em vez de virar esqueleto.

### Os dias vazios são a informação

As séries diárias trazem **todos** os dias do intervalo, inclusive os zerados. Omitir os dias sem dado faria a linha ligar 10 de janeiro direto a 25 de janeiro, desenhando uma inclinação suave onde houve duas semanas sem estudar.

### Agregação em memória, e por quê

O recorte é sempre de um único usuário num intervalo limitado (365 dias no máximo) — algumas centenas de linhas. Nesse volume, buscar e agrupar em JS custa menos que perder a tipagem do Prisma numa query bruta. **Se isso virar consulta multi-usuário ou o intervalo crescer para anos, a conta inverte** e `date_trunc` no SQL passa a valer o custo.

### Endpoint

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/statistics` | Todos os recortes (`period`: 30, 90, 180 ou 365) |

