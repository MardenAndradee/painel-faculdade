# Google Classroom

### Política de merge — leia antes de sincronizar

A sincronização é **incremental e não destrutiva**. O que ela faz com um item já importado:

| Campo | Dono | Na sincronização |
| --- | --- | --- |
| Título, descrição, prazo, estado, pontuação, anexos | Classroom | **Sobrescrito** |
| Prioridade, observações | Você | **Preservado** |
| Cor da disciplina | Você | **Preservado** |
| Status concluído | Você | **Nunca revertido** |

A única mudança de status que a sincronização faz é **marcar** como concluída uma atividade entregue no Classroom — jamais desmarcar.

Essas regras aparecem na própria tela de Integrações: o usuário precisa saber o que acontece antes de clicar.

### Deduplicação

Três chaves únicas por usuário garantem idempotência:

| Entidade | Chave |
| --- | --- |
| Disciplina | `@@unique([userId, googleCourseId])` |
| Atividade | `@@unique([userId, googleCourseWorkId])` |
| Professor | `@@unique([userId, googleUserId])` |

Anexos deduplicam por URL — o Classroom não dá id estável para material dentro de uma atividade.

Sincronizar dez vezes seguidas produz o mesmo resultado que sincronizar uma.

### Escopos: somente leitura

Quatro escopos, **todos `readonly`**. O Painel nunca publica nem altera nada no Classroom. Eles são pedidos por autorização incremental — no clique de "Conectar", não no login.

```
classroom.courses.readonly
classroom.coursework.me.readonly
classroom.rosters.readonly
classroom.student-submissions.me.readonly
```

### Sem o pacote `googleapis`

O `googleapis` traz os tipos de **todas** as APIs do Google (dezenas de MB) para consumirmos quatro endpoints. Usamos `fetch` direto na REST API; o `google-auth-library` cuida só de obter e renovar o token.

### Sincronização automática ao abrir o app

Atividades postadas pelo professor **não** aparecem sozinhas em tempo real — não
há webhook nem processo em segundo plano. O que existe: ao abrir o app, o
frontend avisa o servidor, e **o servidor decide** se sincroniza, comparando
`classroomSyncedAt` com um teto de **30 minutos**.

A decisão fica no servidor de propósito. Se o navegador decidisse, uma aba
recarregando em laço esgotaria a cota da conta Google — o teto viraria sugestão.

| Situação | O que acontece |
| --- | --- |
| Última sincronização há menos de 30 min | Responde "pulei", sem tocar no Google |
| Classroom não conectado | Responde "pulei", sem tentar |
| Sincronizou e nada entrou | **Silêncio** — avisar toda vez viraria ruído |
| Sincronizou e entrou algo | Toast com o que foi importado |
| Falhou | Silêncio no toast, registro no log |

Falha aqui **nunca** vira erro na tela: o usuário só queria abrir o dashboard,
não pediu essa sincronização. O botão **Sincronizar Agora** em Integrações
continua sendo o caminho para forçar e ver o relatório completo com os avisos.

O gatilho vive no `AppShell`, que monta uma vez e persiste — circular entre
telas não redispara nada; só recarregar a página.

### Tolerância a falhas

- Uma turma que falhar **não aborta** as demais — o erro vira aviso no relatório
- **Falhar o professor não aborta a turma**: a disciplina e as atividades entram mesmo assim, e o aviso registra o que faltou
- Rascunhos e itens apagados no Classroom são ignorados
- 401/403 pedem reconexão; 429 pede para tentar mais tarde; 5xx é instabilidade do Google e a mensagem diz isso
- Rate limit próprio: 5 sincronizações a cada 5 minutos, para não esgotar a cota da conta Google

O critério: **o que é acessório não derruba o que é essencial.** O professor é
opcional (`Subject.teacherId` é anulável) — perder o nome dele não pode custar a
importação de uma turma inteira com todas as suas atividades.

### "Turma X: importada sem o professor"

Acontece quando a turma pertence a um **Workspace institucional** e a conta que
sincroniza é **externa** a esse domínio — o caso típico de quem entra com Gmail
pessoal em turmas de `@suafaculdade.edu.br`.

O Google recusa resolver o perfil do professor e responde **`500 INTERNAL`**, não
um 403 honesto. Verificado numa conta real, comparando 7 turmas:

| Turma | Domínio do grupo | `teachers` | `teachers/{id}` | `userProfiles/{id}` |
| --- | --- | --- | --- | --- |
| do professor com conta pessoal | `classroom.google.com` | 200 | 200 | 200 |
| as 6 da instituição | `uniformg.edu.br` | 500 | 500 | 500 |

**Os três caminhos falham igualmente**, então não há alternativa via API — e
nenhum escopo adicional muda isso, porque não é falta de permissão e sim política
de visibilidade de diretório. Entrar com a conta institucional (`@dominio.edu.br`)
provavelmente resolve, já que aí a conta é interna ao domínio.

Consequência prática: a turma e as atividades são importadas normalmente, só o
nome do professor não vem. Você pode preenchê-lo à mão em **Disciplinas**.

Sobre o que acontece nas próximas sincronizações — a regra é
`teacherId ?? existingSubject.teacherId`:

- enquanto o Google continuar sem devolver o professor, **o que você digitou é preservado**;
- se o Google voltar a devolvê-lo, **o dado do Classroom prevalece**, pela mesma
  política de merge das demais colunas vindas da integração.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/integrations/status` | Estado das conexões e contadores |
| GET | `/integrations/classroom/connect` | Devolve a URL de autorização incremental |
| POST | `/integrations/classroom/sync` | Sincroniza e devolve o relatório |
| DELETE | `/integrations/classroom` | Desconecta (dados importados permanecem) |

