# Provas

Diferente de atividades, **prova exige disciplina**: `Exam.subjectId` é obrigatório no schema. Uma prova sem matéria não existe; uma tarefa pessoal pode.

Prova também não tem status "pendente/concluída" — ou já aconteceu, ou não. Os recortes são temporais:

| `view` | Significado |
| --- | --- |
| `proximas` | `date >= agora` |
| `realizadas` | `date < agora` |
| `todas` | Sem recorte |

Ao trocar para "Realizadas" a interface inverte a ordem padrão para **mais recente primeiro** — em provas futuras interessa a mais próxima; em passadas, a última.

### Nota vinculada

`Grade.examId` é único (1-1). A nota vem no mesmo `select` da listagem, então a lista de provas realizadas **já é o histórico**: mostra o resultado quando lançado, ou "Sem nota". O lançamento em si chega na Etapa 10.

Excluir uma prova **não apaga a nota** — a relação usa `onDelete: SetNull`, e o diálogo de confirmação avisa isso.

### Peso

Alimenta a média ponderada da disciplina. Exibido como badge quando diferente de 1, para o usuário enxergar o impacto de cada avaliação.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/exams` | Lista com `view`, `search`, `subjectId`, `sortBy`, `order`, paginação |
| GET | `/exams/counts` | Contagem por recorte (aceita `subjectId`) |
| POST | `/exams` | Cria |
| GET | `/exams/:id` | Detalhes |
| PATCH | `/exams/:id` | Atualiza campos enviados |
| DELETE | `/exams/:id` | Exclui |

