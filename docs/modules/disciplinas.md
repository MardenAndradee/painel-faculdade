# Disciplinas

### Excluir arquiva por padrão

`Exam` e `Grade` usam `onDelete: Cascade` — apagar uma disciplina destrói o histórico de notas do semestre. Por isso:

| Ação | Rota | Efeito |
| --- | --- | --- |
| Arquivar (padrão) | `DELETE /subjects/:id` | Sai da listagem; provas, notas e materiais preservados. Reversível. |
| Excluir de vez | `DELETE /subjects/:id?permanent=true` | Remove tudo em cascata. Irreversível. |

Antes de confirmar a exclusão, a interface consulta `GET /subjects/:id/deletion-impact` e mostra **quantos registros de cada tipo** seriam perdidos, oferecendo arquivar como alternativa.

> **Cuidado com booleanos em query string.** `z.coerce.boolean()` aplica `Boolean(valor)` — e como toda string não vazia é verdadeira, `?permanent=false` viraria `true`. Use o helper `booleanQueryParam()` de `@painel/shared` para qualquer flag booleana vinda da URL.

### Média exibida

Disciplina encerrada tem a média consolidada em `finalGrade`; enquanto está em andamento, a média é calculada das notas lançadas (ponderada por peso, normalizada para 0–10). Disciplina sem nenhuma nota mostra `—`, nunca `0,0`.

### Ordenação por média

`average` não é coluna do banco — é derivada de `Grade`. Nesse caso específico o service busca o conjunto filtrado, calcula, ordena e pagina em memória; as demais ordenações vão direto no SQL. Viável porque um usuário tem dezenas de disciplinas, não milhares. Disciplinas sem nota vão sempre para o fim, em qualquer direção.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/subjects` | Lista com `search`, `semesterId`, `status`, `includeArchived`, `sortBy`, `order`, `page`, `perPage` |
| POST | `/subjects` | Cria (aceita `newTeacherName` para cadastrar o professor junto) |
| GET | `/subjects/:id` | Detalhes, incluindo nota necessária para aprovação |
| PATCH | `/subjects/:id` | Atualiza campos enviados |
| DELETE | `/subjects/:id` | Arquiva (ou exclui com `?permanent=true`) |
| POST | `/subjects/:id/restore` | Desarquiva |
| GET | `/subjects/:id/deletion-impact` | Contagem do que seria perdido |
| GET/POST/PATCH/DELETE | `/teachers` | CRUD de professores |

