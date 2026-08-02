# Guia de contribuição

## Ambiente

Siga a [instalação do README](README.md#instalação). Antes de abrir um PR, garanta que estes três comandos passam:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

## Fluxo de trabalho

1. Crie uma branch a partir da `main`.
2. Faça commits pequenos e descritivos.
3. Abra o PR descrevendo **o que muda e por quê**.

### Nomes de branch

```
feat/nome-da-funcionalidade
fix/descricao-do-bug
refactor/area-afetada
docs/o-que-mudou
chore/tarefa-de-manutencao
```

### Mensagens de commit

Padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(subjects): adiciona filtro por semestre
fix(auth): corrige expiracao do refresh token
refactor(assignments): extrai calculo de atraso para o service
docs(readme): documenta variaveis de ambiente
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`.

## Onde cada coisa vive

Antes de escrever código, confirme a camada:

| Precisa de…                                  | Vá para                          |
| -------------------------------------------- | -------------------------------- |
| Ler a requisição e devolver resposta          | `controllers/`                   |
| Regra de negócio, cálculo, decisão            | `services/`                      |
| Consulta ou escrita no banco                  | `repositories/`                  |
| Schema de validação                           | `validators/` (+ `@painel/shared` se o front também usar) |
| Middleware (auth, rate limit, erro)           | `middlewares/`                   |
| Tipo ou enum usado pelos dois lados           | `packages/shared/src/`           |

### Regras que não se quebram

- Controller **não** contém regra de negócio.
- Service **não** conhece `req`/`res`.
- Prisma é importado **apenas** em `repositories/` (e em `config/prisma.ts`).
- `any` é erro de lint. Se o tipo for realmente desconhecido, use `unknown` e estreite.

## Testes

A suíte cobre as **regras puras** — repetição espaçada, gerador de cronograma,
cálculo de notas e contratos Zod. É onde a lógica de negócio mora e onde os
bugs de fato apareceram.

```bash
npm test
npm run test:watch
```

### O que vale a pena testar aqui

Uma regra pura — que recebe entrada e devolve saída, sem banco e sem `new
Date()` implícito. Se a função precisar do "agora", **injete-o como parâmetro**:
um teste que depende do relógio passa às 23h50 e falha às 00h10, e uma suíte
que falha sozinha vira ruído em vez de sinal.

### Antes de considerar um teste pronto

**Quebre a regra de propósito e confirme que o teste falha.** Um teste que
continua verde com a implementação quebrada não protege nada — e vários assim
foram escritos e corrigidos ao longo deste projeto.

### Ao adicionar um schema com `.default()`

O `.partial()` do Zod torna os campos opcionais mas **não** remove os defaults.
Use o padrão `xBaseSchema` (defaults só no schema de criação) e acrescente um
caso em `packages/shared/src/schemas/contracts.test.ts`. Esse foi o bug mais
grave do projeto: a API respondia 200 enquanto reescrevia dados do usuário.
- Erro previsível → `AppError`. Nunca devolva `res.status(500)` manualmente.

## Banco de dados

Alterou `schema.prisma`? Gere a migration:

```bash
npm run db:migrate -- --name descricao_curta
```

- **Nunca** edite uma migration já commitada — crie uma nova.
- Toda entidade de usuário precisa de `userId` com `onDelete: Cascade`.
- Identificadores externos do Google são únicos **por usuário**: `@@unique([userId, googleAlgumId])`.
- Adicionou entidade? Atualize a tabela de entidades no README.

## Frontend

- **Mobile first**: estilize o menor breakpoint primeiro, depois `sm:`, `md:`, `lg:`.
- Use os tokens de tema (`bg-card`, `text-muted-foreground`), **nunca** cores fixas como `bg-white` — quebram o dark mode.
- Componentes do shadcn/ui vão em `components/ui/`; os do domínio, em `components/`.
- Formulário = React Hook Form + Zod, com o schema vindo de `@painel/shared`.
- Toda tela precisa tratar os estados de **loading**, **erro** e **vazio**.

## Revisão

O PR será avaliado por:

- Respeito às camadas
- Tipagem completa, sem `any`
- Tratamento dos estados de UI
- Funcionamento em mobile, tablet e desktop
- Funcionamento nos temas claro e escuro
- Comentários explicando o **porquê** quando a intenção não é óbvia
