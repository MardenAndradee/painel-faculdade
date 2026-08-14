# Autenticação: e-mail + senha (planejado)

> **Só plano — nenhum código, migration ou schema foi alterado nesta etapa.**
> Este documento é a Etapa 1 (análise) já resolvida, mais arquitetura,
> modelagem, fluxos, riscos e um plano por etapas. As decisões em aberto
> foram todas respondidas (ver "Decisões" abaixo) — falta só o sinal final
> pra começar a implementar.

### Objetivo

Hoje o único jeito de entrar é "Continuar com Google" (seção "## Autenticação"
acima). Passar a aceitar **e-mail + senha**, com os dois métodos podendo
representar o **mesmo usuário** quando vinculados — nunca dois `User`
diferentes pra uma pessoa só.

### O que a análise encontrou (Etapa 1)

Pontos do sistema atual que **restringem** o desenho da solução:

| Onde | O que é hoje | Por que importa pro plano |
| --- | --- | --- |
| `User.googleId` | `String @unique`, **obrigatório** | Todo usuário existente tem um. Não pode virar "e-mail OU senha OU google" sem abrir espaço pra usuário sem `googleId` |
| `User.email` | `String @unique` | Continua sendo a chave humana da conta — os dois métodos apontam pro mesmo e-mail |
| Identidade do Google | `payload.sub` (`googleId`), **nunca o e-mail** (`apps/api/src/config/google.ts:112`) | O projeto já faz a coisa certa aqui — só precisa mover de coluna do `User` pra uma tabela própria |
| `googleAccessToken`/`googleRefreshToken`/`googleTokenExpiry`/`googleGrantedScopes` | Colunas do `User`, lidas por `integration.service.ts` pra sincronizar Classroom/Calendar | **Não são identidade — são credencial de integração.** Não precisam (e não devem) mudar de lugar |
| Sessão (access/refresh JWT, cookie httpOnly, rotação com detecção de reuso) | `auth.service.ts` / `jwt.ts` / `cookies.ts` | Já é sólido — o plano **reaproveita inteiro**, só troca o que autentica antes de chamar `issueSession()` |
| Proteção de rota | `AuthGuard` no frontend (client-side), sem `middleware.ts` | Sem mudança — continua igual pros dois métodos |
| Rate limit de login | `authRateLimiter`, 20 req/15min **por IP**, só no fluxo Google hoje | Senha precisa de limite **por IP e por conta** — força bruta distribuída (várias origens, uma conta) escapa de um limite só por IP |
| Hash de senha | Não existe (`bcrypt`/`argon2` não estão instalados) | Zero legado pra migrar — decisão limpa |
| Envio de e-mail | Não existe ainda (ver "Etapa 25 — Envio de e-mail", planejada, não implementada) | Verificação de e-mail e recuperação de senha **dependem** dela — ver riscos |
| Desconectar Classroom/Calendar | Já são ações **próprias e independentes** (`DELETE /integrations/classroom`, `DELETE /integrations/calendar`) | Desvincular o Google como MÉTODO DE LOGIN é uma terceira ação, separada dessas duas — não mexe no acesso ao Classroom/Calendar |

### Arquitetura: `User` + `AuthIdentity`

**Sim, separar é a decisão certa pra este projeto**, pelo motivo que a stack
já demonstra em outro lugar: o padrão "registro canônico + o que aponta pra
ele" é o mesmo usado em Turmas (`Class` + `ClassMember`) e em Publicações
(`ClassPost` + `ClassPostCopy`). Aqui o "registro canônico" é a pessoa
(`User`), e cada jeito dela provar quem é (senha, Google, e no futuro
Microsoft/Apple se algum dia fizer sentido) é uma linha que aponta pra ela.

```
User
  id, name, email (único), passwordHash?, emailVerifiedAt?
  ... (todos os campos e relações atuais, sem mudança)
  googleAccessToken / googleRefreshToken / googleTokenExpiry / googleGrantedScopes
  → CONTINUAM AQUI: são credencial de integração (Classroom/Calendar), não
    identidade de login. integration.service.ts não muda uma linha.

AuthIdentity
  id, provider (enum, hoje só GOOGLE), providerAccountId, userId, createdAt
  @@unique([provider, providerAccountId])  -- essa conta Google só pode apontar pra 1 User
  @@unique([userId, provider])             -- 1 User só tem 1 Google vinculado
```

Por que `providerAccountId` e nunca o e-mail (exatamente como pedido): o
Google permite trocar o e-mail de uma conta; se a chave fosse o e-mail, essa
troca faria o sistema "perder" o vínculo com o histórico do usuário. O
projeto **já faz isso certo hoje** (`googleId = payload.sub`) — a mudança é
só de *onde* mora essa coluna, não da regra em si.

**Por que a senha não vira uma `AuthIdentity`.** `AuthIdentity` existe pra
identidades de **terceiros** (OAuth) — provider + id de conta de outro
sistema. Senha não é isso: é intrínseca ao `User`, então
`passwordHash`/`emailVerifiedAt` ficam direto nele, do jeito que o próprio
pedido já esboçou.

**O que propositalmente NÃO muda:** `googleAccessToken`, `googleRefreshToken`,
`googleTokenExpiry`, `googleGrantedScopes`, `classroomSyncedAt`,
`calendarSyncedAt` continuam no `User`. São o crachá de acesso às APIs do
Classroom/Calendar, não a prova de identidade — mover isso pra
`AuthIdentity` obrigaria a reescrever `integration.service.ts` sem nenhum
ganho real, e o pedido explícito é **não quebrar essa integração**.

### Modelagem (schema proposto — só documentado, não aplicado)

```prisma
enum AuthProvider {
  GOOGLE
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  avatarUrl     String?

  /// Nulo pra quem só usa Google. Nunca em texto puro - hash argon2id.
  passwordHash    String?
  /// Nulo = e-mail nunca confirmado. Setado automaticamente no cadastro via
  /// Google (o Google já verifica), manualmente no fluxo de verificação
  /// pro cadastro por senha.
  emailVerifiedAt DateTime?
  /// Setado no PRIMEIRO login por senha bem-sucedido, nunca mais tocado.
  /// Distingue "a pessoa já provou que sabe a senha" de "só o e-mail foi
  /// confirmado" - a diferença que fecha o risco R1 por completo (ver
  /// "Riscos" e Fluxo 3/4). Nulo = senha nunca comprovada; se um auto-link
  /// do Google acontecer nesse estado, a senha é invalidada no ato.
  passwordClaimedAt DateTime?

  /// DEPRECADO - mantido indefinidamente como rede de segurança (Decisões,
  /// item 4), sem leitura nenhuma depois que `AuthIdentity` vira fonte da
  /// verdade (Etapa 3). Sem prazo de remoção definido.
  googleId String? @unique

  // ... todos os campos e relações atuais continuam exatamente iguais ...
  googleAccessToken   String?   @db.Text
  googleRefreshToken  String?   @db.Text
  googleTokenExpiry   DateTime?
  googleGrantedScopes String[]  @default([])

  authIdentities AuthIdentity[]
  passwordResetTokens EmailToken[]

  @@map("users")
}

model AuthIdentity {
  id                String       @id @default(cuid())
  provider          AuthProvider
  /// `sub` do Google - nunca o e-mail (ver "Arquitetura").
  providerAccountId String

  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@unique([userId, provider])
  @@map("auth_identities")
}

enum EmailTokenPurpose {
  VERIFY_EMAIL
  RESET_PASSWORD
}

/// Token de uso único enviado por e-mail (Etapas 4 e 9) - mesmo padrão de
/// hash já usado em `RefreshToken`/`ClassInvite`: só o hash é persistido.
model EmailToken {
  id        String            @id @default(cuid())
  purpose   EmailTokenPurpose
  tokenHash String            @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime          @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
  @@map("email_tokens")
}
```

### Fluxos

**1 — Cadastro normal.** `POST /auth/register` (nome, e-mail, senha) → e-mail
já em uso? `409`. Não → hash da senha (`argon2id`), cria `User` (sem
`AuthIdentity`, `emailVerifiedAt: null`) → emite sessão igual a hoje
(`issueSession`, mesmo cookie/JWT) → dashboard, sem esperar verificação
(Decisões, item 1). Dispara e-mail de verificação em paralelo, sem bloquear
o login; até verificar, a conta fica fora do auto-link do Fluxo 3/4 (R1).

**2 — Login normal.** `POST /auth/login` (e-mail, senha) → busca `User` por
e-mail → `passwordHash` nulo (conta só-Google) ou senha não bate → **mesma
mensagem genérica** nos dois casos ("e-mail ou senha inválidos") — dizer
"esta conta usa Google" a quem não provou a senha é enumeração de usuário →
bate → `issueSession()` → dashboard.

**3 — Novo usuário com Google** e **4 — Google já vinculado** são o MESMO
código (`loginWithGoogle` de hoje, adaptado):

```
Google OAuth → identidade validada (payload.sub, email_verified obrigatório)
  → AuthIdentity(GOOGLE, sub) existe?
      SIM → User dela → login (Fluxo 4)
      NÃO → User com este e-mail já existe?
              SIM → cria AuthIdentity apontando pra ele → login
                    (é o exemplo do pedido: marden@gmail.com já existe,
                    Google com o mesmo e-mail LINKA, não duplica)
              NÃO → cria User + AuthIdentity (Fluxo 3, igual a hoje)
```

O auto-link por e-mail é automático (Decisões, item 2). Duas camadas o
protegem contra o risco R1 (*pre-hijacking* — ver "Riscos"): o Google **já
verificou** esse e-mail (`email_verified`, checado hoje em `google.ts:106`);
a conta local correspondente precisa ter o dela confirmado
(`emailVerifiedAt` não nulo) pra ser candidata ao link. E, como a verificação
sozinha não prova que a senha da conta pertence a quem clicou no e-mail (só
prova que o e-mail chegou), o link **invalida a senha existente** se ela
nunca foi usada num login bem-sucedido antes — só nesse caso específico,
nunca quando a própria pessoa já provou a senha alguma vez.

**5 — Vincular Google numa conta já logada.** Sempre autenticado
(`Bearer` válido). `POST /auth/me/link/google` → mesma tela de consentimento
→ e-mail do Google bate com o e-mail do usuário **logado**? Sim → cria
`AuthIdentity`. Não → Fluxo 6.

**6 — Google com e-mail diferente.** Bloqueado, sempre — nunca vincula
silenciosamente. Mensagem clara: "Esta conta Google usa outro e-mail
(...); entre com a conta certa ou vincule depois de trocar seu e-mail
aqui." Vale tanto pra alguém tentando vincular pelo Configurações quanto,
por segurança, como regra geral de qualquer vínculo.

**7 — Google já vinculado a outro usuário.** `AuthIdentity` tem
`@@unique([provider, providerAccountId])` — o banco já impede duas linhas
pra mesma conta Google. O service traduz a violação em `409` claro: "esta
conta Google já está vinculada a outro usuário do Painel."

### Métodos de login (Configurações → Conta)

Superfície nova (não existe tela de Configurações hoje — ver Etapa 25, que
cogitou o mesmo toggle solto no menu do usuário; os dois cabem juntos nesta
tela quando ela existir).

```
GET /auth/me/login-methods
  → { hasPassword: boolean, linkedProviders: ['google'?] }

POST   /auth/me/link/google      -- Fluxo 5
DELETE /auth/me/link/google      -- desvincula (com a trava abaixo)
POST   /auth/me/password         -- "Adicionar senha" (conta só-Google)
PATCH  /auth/me/password         -- trocar senha (pede a senha atual)
```

**Nunca remover o último método válido.** `DELETE /auth/me/link/google`
checa `passwordHash !== null` antes de apagar a `AuthIdentity`; senha sem
Google vinculado não tem o que remover (não há "desvincular senha", só
trocar). Uma conta sem NENHUM jeito de entrar é uma conta perdida.

### Riscos

| # | Risco | Mitigação proposta |
| --- | --- | --- |
| R1 | **Sequestro por "ocupação" de e-mail** (categoria conhecida como *pre-hijacking*): alguém cadastra `victim@gmail.com` com senha (sem ser dono da caixa); depois a vítima real usa "Continuar com Google" com o e-mail dela → o auto-link (Fluxo 3/4) linkaria a conta Google real à conta senha do atacante | Base: `emailVerifiedAt` exigido antes de elegível pro auto-link (fecha o caso ingênuo — ninguém nunca verificou). **Refinamento que fecha o caso completo:** só tratar a senha como "reivindicada pelo dono de verdade" depois do PRIMEIRO login por senha bem-sucedido; se o Google linkar numa conta cujo e-mail foi verificado mas cuja senha **nunca** foi usada pra entrar, invalidar essa senha no ato do link e avisar por e-mail ("sua senha foi redefinida por segurança") — fecha a janela mesmo se o atacante induzir a vítima a clicar no link de verificação. Ver nota abaixo dos Fluxos: proponho como parte da Etapa 6, não como extra opcional |
| R2 | Força bruta distribuída (várias origens, mesma conta) escapando do rate limit por IP | Limite **por conta** além do por IP — contador de tentativas falhas + bloqueio temporário em `User`, não só `express-rate-limit` |
| R3 | Enumeração de usuário via mensagens diferentes ("e-mail não existe" vs "senha errada", ou "e-mail enviado" só quando a conta existe) | Mensagem genérica sempre — login (Fluxo 2) e "esqueci a senha" (Etapa 9) nunca revelam se o e-mail existe |
| R4 | Senha fraca | Política simples (comprimento mínimo, sem regra de complexidade artificial — orientação atual do NIST é comprimento > complexidade forçada) |
| R5 | Migração perder ou duplicar usuário existente | Backfill em duas fases (Etapa 3): criar+conferir `AuthIdentity` ANTES de qualquer leitura mudar de fonte; `User.id` nunca muda, então toda FK do sistema (dezenas de tabelas) permanece intacta o tempo todo |
| R6 | Recuperação de senha depende de e-mail, que ainda não existe (Etapa 25 não implementada) | Etapa 9 entra no plano (Decisões, item 5); implementação real fica bloqueada até a Etapa 25 (ou um provedor mínimo, só pra isso) estar pronta — mesmo espírito da Etapa 25 em si |
| R7 | `argon2id` nativo em ambiente serverless (Vercel) | Prisma já exige runtime Node (não Edge) nas functions da API, então módulo nativo funciona pelo mesmo motivo que `@prisma/client` já funciona; confirmar no deploy da Etapa 4 que o binário prebuilt do `argon2` cobre o runtime da Vercel — se der problema de build, `bcrypt`/`bcryptjs` ficam como plano B sem redesenhar nada além da função de hash |

### Decisões

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Cadastro por senha entra logo autenticado, ou espera verificação de e-mail? | **Loga na hora** (fricção baixa). A conta fica "não verificada" e continua **fora** da comparação de auto-link do Fluxo 3/4 até verificar (R1) — um Google com esse e-mail, enquanto isso, cai no fluxo de "conta nova" com aviso de e-mail já cadastrado, não linka sozinho |
| 2 | Vínculo automático por e-mail, sem tela de confirmação? | **Sim, automático** — sem etapa extra de confirmação, exatamente como no pedido original, respeitando a trava do item 1 (só linka conta já verificada) |
| 3 | `bcrypt` ou `argon2id`? | **`argon2id`** — recomendação atual do OWASP; ver R7 pro risco de deploy e o plano B |
| 4 | Remover `User.googleId` já, ou manter? | **Mantém** — fica como coluna deprecada, sem leitura, sem prazo definido de remoção |
| 5 | Etapa 9 (recuperação de senha) entra no plano? | **Sim** — mesmo dependendo da Etapa 25 (R6); a implementação fica *code-complete* e só liga de verdade quando o envio de e-mail existir |

### Plano por etapas

#### Etapa 1 — Análise da autenticação atual ✅

Já feita — é este documento até aqui (seção "O que a análise encontrou").

#### Etapa 2 — Modelagem `User` + `AuthIdentity`

**Objetivo.** Schema pronto, sem mudar nenhum comportamento.
**Banco.** Migration aditiva: `AuthIdentity`, `EmailToken`, `AuthProvider`,
`EmailTokenPurpose`; `User` ganha `passwordHash?`, `emailVerifiedAt?` (tudo
opcional — nenhuma linha existente é afetada). `googleId` continua como
está, sem tocar.
**Backend.** Só o client do Prisma regenerado; nenhum service muda.
**Frontend.** Nada.
**Riscos.** Baixo — é só schema novo ao lado do que já existe.
**Testes.** Migration aplica limpo num banco com dados reais (cópia de
produção ou seed representativo).
**Aceite.** App sobe normal, login com Google continua idêntico a hoje.

#### Etapa 3 — Migração dos usuários existentes

**Objetivo.** Todo `User` atual ganha a `AuthIdentity` correspondente, sem
perder nem duplicar ninguém.
**Banco.** Migration de dado (SQL): `INSERT INTO auth_identities (id,
provider, "providerAccountId", "userId", "createdAt") SELECT
gen_random_uuid()::text, 'GOOGLE', "googleId", id, now() FROM users WHERE
"googleId" IS NOT NULL`. Roda dentro de uma transação; confere
`COUNT(users) = COUNT(auth_identities)` antes de seguir.
**Backend.** `loginWithGoogle` passa a resolver por `AuthIdentity` (Fluxos
3/4); `googleId` para de ser escrito, mas a coluna **continua existindo**
(não lida por ninguém) até a limpeza posterior — rede de segurança barata.
**Frontend.** Nada.
**Riscos.** O único item deste plano inteiro que toca dado de usuário
real — por isso é etapa própria, isolada de qualquer outra mudança, com
teste de contagem antes/depois obrigatório.
**Testes.** Rodar contra um snapshot do banco atual (ou staging com dados
reais): todo usuário existente continua logando com a MESMA conta depois da
migração — sem `User` novo criado nem sessão de ninguém invalidada.
**Aceite.** 100% dos usuários com `googleId` têm exatamente 1
`AuthIdentity`; login de conta antiga funciona sem diferença perceptível.

#### Etapa 4 — Cadastro com e-mail e senha

**Objetivo.** Fluxo 1 completo.
**Banco.** Nenhuma mudança nova (já coberta na Etapa 2).
**Backend.** `POST /auth/register`; hash da senha (`argon2id`);
`EmailToken(VERIFY_EMAIL)` gerado e "enviado" (loga/mocka até a Etapa 25
existir de verdade); rate limit próprio (cadastro em massa é o mesmo tipo
de abuso que login repetido).
**Frontend.** Formulário de cadastro na tela de login (nome, e-mail, senha,
confirmar senha), validação client-side espelhando o schema Zod
(convenção já usada no projeto inteiro).
**Riscos.** Ver R1 e R4 (política de senha).
**Testes.** E-mail duplicado rejeita; senha fraca rejeita; sessão emitida
bate com o mesmo formato do login Google (`AuthUser`/`AuthSession`
inalterados).
**Aceite.** Cadastro cria `User` com `passwordHash`, sem `AuthIdentity`,
loga igual ao fluxo Google.

#### Etapa 5 — Login com e-mail e senha

**Objetivo.** Fluxo 2 completo.
**Banco.** Nenhuma.
**Backend.** `POST /auth/login`; comparação de senha sempre passa pelo hash
(nunca comparação direta); mensagem genérica em qualquer motivo de falha
(R3); contador de tentativas falhas por conta (R2); grava
`passwordClaimedAt` no primeiro sucesso, se ainda nulo (base do
refinamento de R1, usado na Etapa 6).
**Frontend.** Formulário de login (e-mail, senha) ao lado do botão
"Continuar com Google" já existente — os dois convivem na mesma tela.
**Riscos.** R2, R3.
**Testes.** Senha certa loga; senha errada, e-mail inexistente e conta
só-Google devolvem a MESMA mensagem; N tentativas seguidas bloqueiam
temporariamente.
**Aceite.** Login por senha entrega a mesma sessão (cookie + access token)
que o login Google.

#### Etapa 6 — Google para usuário novo ou já vinculado

**Objetivo.** Fluxos 3 e 4 — `loginWithGoogle` reescrito sobre
`AuthIdentity`.
**Banco.** Nenhuma (a partir daqui `AuthIdentity` já é a fonte da
verdade, migrada na Etapa 3).
**Backend.** Reescreve a árvore de decisão do Fluxo 3/4 (ver "Fluxos"
acima) dentro de `authService.loginWithGoogle`; ao linkar numa conta com
`emailVerifiedAt` preenchido mas `passwordClaimedAt` nulo, invalida
`passwordHash` (seta `null`) e loga o evento; `updateGoogleTokens`
continua exatamente igual (credencial de integração, não muda).
**Frontend.** Nenhuma mudança visível — o botão "Continuar com Google" já
existe e continua chamando a mesma rota.
**Riscos.** R1 (auto-link por e-mail, com o refinamento da senha nunca
comprovada) — é o coração desta etapa.
**Testes.** Google novo → `User` novo; Google já vinculado → mesma conta;
Google com e-mail de conta senha verificada E já usada pra logar
(`passwordClaimedAt` preenchido) → linka, senha preservada (é o exemplo do
pedido); verificada mas nunca usada pra logar → linka E invalida a senha;
não verificada → não linka, e-mail tratado como já cadastrado.
**Aceite.** Nenhum usuário Google existente percebe diferença; o
cenário-exemplo do pedido (senha primeiro, Google depois, mesmo e-mail)
resulta em `User` único.

#### Etapa 7 — Configurações → vincular/desvincular Google

**Objetivo.** Fluxos 5, 6 e 7.
**Banco.** Nenhuma.
**Backend.** `POST/DELETE /auth/me/link/google`, com as travas de e-mail
diferente (Fluxo 6, 409) e conta Google já vinculada em outro lugar
(Fluxo 7, 409 pelo `@@unique`) e de "não remover o último método" (ver
"Métodos de login").
**Frontend.** Ainda sem tela própria — endpoint pronto, consumido pela
Etapa 8.
**Riscos.** Confusão de UX se o erro do Fluxo 6 não for claro sobre QUAL
e-mail bateu e qual não.
**Testes.** Vincular com e-mail certo funciona; e-mail diferente bloqueia
com mensagem clara; Google já vinculado a outro `User` bloqueia; conta
só-Google não consegue desvincular sem senha configurada antes.
**Aceite.** Os três fluxos de bloqueio (6, 7, "último método") nunca
deixam uma conta inacessível nem vinculam silenciosamente.

#### Etapa 8 — Tela de métodos de login

**Objetivo.** Superfície visual pros endpoints da Etapa 7.
**Banco.** Nenhuma.
**Backend.** `GET /auth/me/login-methods`; `POST/PATCH /auth/me/password`.
**Frontend.** Primeira tela de Configurações do app (`Configurações →
Conta → Métodos de login`) — mostra e-mail/senha e Google com estado
"Configurado"/"Vinculado" e as ações de cada um, conforme o mockup do
pedido. Ponto de encontro natural com o toggle de "Notificações por
e-mail" cogitado na Etapa 25.
**Riscos.** Baixo — é UI sobre endpoints já testados na Etapa 7.
**Testes.** Estado da tela reflete exatamente `GET
/auth/me/login-methods`; ação de desvincular/adicionar senha atualiza a
tela sem recarregar.
**Aceite.** Dá pra sair de "só Google" para "Google + senha" (ou
vice-versa) inteiramente pela interface, sem nunca ficar sem nenhum
método.

#### Etapa 9 — Recuperação de senha

**Objetivo.** "Esqueci minha senha" — entra no plano (Decisões, item 5),
condicionada à Etapa 25 pra rodar de verdade (R6).
**Banco.** Reaproveita `EmailToken(RESET_PASSWORD)`, já modelado na Etapa
2.
**Backend.** `POST /auth/forgot-password` (sempre resposta genérica,
R3); `POST /auth/reset-password` (token + nova senha, token de uso único
com expiração curta — mesmo padrão de `ClassInvite`/`RefreshToken`).
**Frontend.** Tela "Esqueci minha senha" + "Redefinir senha".
**Riscos.** R3, R6 — sem envio de e-mail de verdade (Etapa 25), fica
sem como testar o fluxo ponta a ponta em produção.
**Testes.** Token expirado/usado rejeita; resposta idêntica pra e-mail
existente e inexistente.
**Aceite.** Só pode avançar de verdade quando a Etapa 25 (ou um envio
mínimo dedicado) estiver pronta — até lá, fica code-complete mas sem
ligar em produção.

#### Etapa 10 — Segurança e testes

**Objetivo.** Fechar o checklist de segurança do pedido, com tudo que não
coube dentro de uma etapa específica.
**Banco.** Índices de suporte se o contador de tentativas falhas (R2)
precisar (ex. `@@index([email, updatedAt])` se for tabela própria em vez
de coluna no `User`).
**Backend.** Revisão cruzada de R1–R7; rate limit dedicado em
`/auth/register` e `/auth/login` (hoje só Google tem `authRateLimiter`).
**Frontend.** Nenhuma.
**Riscos.** É a etapa que EXISTE pra pegar o que ficou barato demais nas
anteriores — tratar como checklist, não como formalidade.
**Testes.** Roteiro E2E real (mesmo padrão usado no resto do projeto:
usuários reais contra banco e servidor rodando) cobrindo os 7 fluxos numa
sequência só, incluindo o cenário do pedido (senha → Google, mesmo
e-mail, um `User` só).
**Aceite.** Todos os pontos de "Aceite" das Etapas 4–9 revalidados juntos,
numa passada só.

