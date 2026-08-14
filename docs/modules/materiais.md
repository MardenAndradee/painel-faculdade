# Materiais

Um material é um **arquivo enviado** ou um **link externo**. As duas formas vivem na mesma entidade porque cumprem o mesmo papel para quem estuda; o que muda é o `source`.

### Storage atrás de uma interface

Nenhuma camada de negócio sabe onde os bytes moram. `StorageProvider` (`apps/api/src/storage/types.ts`) define `save`/`createReadStream`/`remove`/`removeMany`. Duas implementações existem hoje, escolhidas por `STORAGE_DRIVER`:

- `LocalStorageProvider` — grava em `UPLOAD_DIR`. Só funciona com disco persistente (dev local, Docker com volume).
- `R2StorageProvider` — fala com o Cloudflare R2 via API compatível com S3. Obrigatório em produção serverless (Vercel), onde não há disco entre invocações.

Service, controller e rota ficam intactos nos dois casos — só conhecem `storage`, nunca o provider concreto.

A chave é sempre gerada pela aplicação, nunca pelo cliente:

```
{userId}/{ano}/{mês}/{uuid}{extensão}
```

O prefixo por usuário prepara políticas de acesso por prefixo num bucket, e o nome aleatório torna *path traversal* impossível por construção — o nome original vira apenas rótulo de exibição.

### O que é validado, e por quê

| Camada | Regra |
| --- | --- |
| Extensão | **Allowlist** — nunca blocklist, que sempre esquece um formato executável novo |
| Tamanho | `MAX_UPLOAD_SIZE_MB` (25 MB), aplicado pelo multer antes de ler o corpo inteiro |
| Conteúdo | *Magic bytes* conferidos contra a extensão declarada |
| MIME | Derivado da extensão no servidor — o MIME enviado pelo cliente é ignorado |

O `Content-Type` do multipart é escolhido por quem envia: um executável renomeado para `.pdf` chega anunciado como `application/pdf`. Por isso os primeiros bytes são conferidos. Formatos de texto (`.txt`, `.md`, `.csv`, `.svg`) não têm assinatura binária; para eles a checagem é o conteúdo ser decodificável como UTF-8 sem bytes nulos, o que já barra binário disfarçado.

O multer usa `memoryStorage`. Com `diskStorage` o arquivo seria gravado **antes** de qualquer validação, e cada tentativa inválida deixaria lixo no disco.

### Download é rota autenticada, não pasta estática

Servir `UPLOAD_DIR` com `express.static` daria a qualquer um com o caminho acesso ao arquivo de qualquer usuário. O download passa por `GET /attachments/:id/download` → `authenticate` → checagem de dono → stream, e sempre com:

- `Content-Disposition: attachment` — nunca inline;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`.

Como `<img src>` e `<iframe src>` não enviam o header `Authorization`, o frontend busca os bytes pelo cliente HTTP e monta um *object URL* local. A pré-visualização de PDF roda em `<iframe sandbox="">`.

SVG é aceito no upload mas **nunca** é pré-visualizado inline: é XML e pode carregar script, o que seria XSS armazenado no nosso domínio.

### Exclusão em cascata não deixa arquivos órfãos

O banco apaga as linhas de `Attachment` por cascata quando a disciplina, atividade ou prova some — mas não conhece o disco. Os services desses donos chamam `purgeStorageForOwner` **antes** de excluir. Para disciplina o alcance é transitivo: leva também os materiais das provas e atividades dela.

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/attachments` | Lista paginada (filtros: `search`, `subjectId`, `type`, `source`) |
| GET | `/attachments/summary` | Contagens e espaço ocupado |
| POST | `/attachments/upload` | Envia um arquivo (multipart, campo `file`) |
| POST | `/attachments/link` | Cadastra um link |
| GET | `/attachments/:id` | Metadados |
| GET | `/attachments/:id/download` | Baixa o arquivo |
| PATCH | `/attachments/:id` | Renomeia e/ou revincula |
| DELETE | `/attachments/:id` | Exclui registro e arquivo |

