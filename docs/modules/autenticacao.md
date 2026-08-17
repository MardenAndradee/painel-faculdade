# Autenticação

### Fluxo de login

```
Browser  →  GET  /auth/google           → redireciona ao consentimento do Google
Google   →  GET  /auth/google/callback  → valida state, troca code por tokens,
                                          redireciona levando o refresh token
                                          no FRAGMENTO da URL (#session=...)
Browser  →  POST /auth/session          → troca o token do fragmento pela sessao;
                                          o cookie httpOnly e gravado AQUI
Browser  →  POST /auth/refresh          → recarregamentos seguintes: recebe o
                                          access token no corpo, a partir do cookie
```

O access token **nunca trafega pela URL** em nenhuma etapa. Passá-lo por query string o exporia no histórico do navegador, nos logs de acesso do servidor e no header `Referer`.

O refresh token, por sua vez, viaja no **fragmento** (`#session=...`) só entre o callback e `/auth/callback` no frontend — o fragmento nunca chega a nenhum servidor (nem ao nosso, nem a um proxy, nem a um log de acesso), e o frontend o remove da barra de endereços assim que lê.

**Por que o cookie não é gravado direto no redirecionamento do callback.** Essa era a implementação original, e funciona em Chrome/Firefox — mas o Safari (ITP) limita a validade de cookies gravados numa resposta de redirecionamento logo após uma navegação vinda de outro site (o Google, nesse caso), *ignorando silenciosamente* o `Max-Age` configurado. Na prática, a sessão parecia expirar em menos de 7 dias sem nenhum erro visível, e o usuário era deslogado com frequência — especialmente perceptível num PWA adicionado à tela de início do iOS. `POST /auth/session` existe só para fugir desse padrão: troca o token do fragmento pela sessão através de um `fetch` comum, fora de qualquer cadeia de redirecionamento, onde o cookie é gravado com a validade correta. A rotina de validação é a mesma do `/auth/refresh` — o token do callback é tratado como um refresh token igual a qualquer outro.

### Onde cada token fica

| Token | Local | Validade | Motivo |
| --- | --- | --- | --- |
| Access | Memória (React Context) | 15 min | `localStorage` é legível por qualquer script injetado |
| Refresh | Cookie `httpOnly`, `SameSite`, `path=/api/v1/auth` | 7 dias | Fora do alcance do JavaScript — imune a XSS |

Recarregar a página descarta o access token; o `AuthProvider` o recupera silenciosamente pelo cookie. A renovação também acontece de forma proativa, 1 minuto antes de expirar.

### Rotação e detecção de reuso

Cada `POST /auth/refresh` revoga o token apresentado e emite um novo. Se um token **já revogado** reaparecer, isso indica roubo: todas as sessões daquele usuário são derrubadas. O banco guarda somente o hash SHA-256 — o valor puro nunca é persistido.

**Janela de tolerância (Etapa 33).** Revogar tudo a cada reaparecimento também disparava num cenário 100% legítimo: a renovação proativa roda sozinha em segundo plano, e se o aparelho for suspenso/perder rede bem no meio (a resposta com o cookie novo nunca chega a ser salva), ele reapresenta o token antigo, já revogado, na próxima tentativa — sem nenhum roubo envolvido. Sintoma relatado: "logar no celular desloga o navegador do PC".

`isWithinReuseGrace` (`apps/api/src/utils/refresh-token-grace.ts`) dá 30 segundos de tolerância medidos a partir do `revokedAt` original: um token revogado reaparecendo dentro da janela emite uma sessão nova sem revogar o registro de novo (revogar de novo reiniciaria a janela). Fora da janela, o comportamento é o de sempre — reuso de verdade, derruba tudo.

**Detalhe que quebrava a própria revogação em massa.** `revokeAllForUser` (reuso real detectado, troca/redefinição de senha, sair de todos os dispositivos) só marcava `revokedAt` nos outros tokens — e um desses tokens, reapresentado nos 30s seguintes a ESSA revogação em massa, também caía dentro da janela e era perdoado, ressuscitando uma sessão que a revogação em massa deveria ter matado. Por isso `revokeAllForUser` **apaga** as linhas em vez de só marcá-las: reapresentar um token apagado cai direto em "sessão inválida", sem chance de cair na janela de tolerância. Só a rotação normal (`revoke`, um registro por vez) marca `revokedAt` e fica elegível para a janela.

### Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/auth/google` | — | Inicia o fluxo OAuth |
| GET | `/auth/google/callback` | — | Retorno do Google |
| POST | `/auth/session` | — | Troca o token do fragmento do callback pela sessão (grava o cookie) |
| POST | `/auth/refresh` | cookie | Rotaciona a sessão e devolve o access token |
| POST | `/auth/logout` | cookie | Encerra a sessão atual |
| GET | `/auth/me` | Bearer | Perfil do usuário |
| PATCH | `/auth/me` | Bearer | Atualiza nome, tema e fuso |
| POST | `/auth/logout-all` | Bearer | Encerra todas as sessões |
| GET | `/dashboard/summary` | Bearer | Resumo agregado do dashboard |

O início de sessão usa rate limit estrito (20 req / 15 min); `/auth/refresh` tem limite próprio e mais folgado (120 req / 15 min), por ser chamado a cada carregamento de página.

### Proteção de rotas no frontend

Tudo sob o grupo `app/(app)/` passa pelo `AuthGuard`, que aguarda a restauração da sessão antes de renderizar. Não usamos `middleware.ts` do Next para isso: como o cookie tem `path=/api/v1/auth`, ele não é enviado ao servidor do Next — consequência deliberada de restringir o alcance do cookie.

## E-mail e senha (Etapa 26)

Google deixou de ser o único jeito de entrar. Os dois métodos podem representar o **mesmo usuário** quando vinculados — nunca dois `User` diferentes para uma pessoa só.

### Por que a identidade do Google saiu do `User`

Antes desta etapa, `User.googleId` era `String @unique` **obrigatório** — todo usuário tinha um, porque só existia um jeito de entrar. Introduzir senha exigia abrir espaço para contas sem Google, e a identidade de um provedor de terceiro passou a morar em tabela própria:

```
User
  id, name, email (único), passwordHash?, emailVerifiedAt?, passwordClaimedAt?
  failedLoginAttempts, lockedUntil          -- limite de tentativas por conta (R2)
  googleId  String? @unique                  -- DEPRECADO, nunca mais escrito
  googleAccessToken / googleRefreshToken / googleTokenExpiry / googleGrantedScopes
  → continuam aqui: são credencial de INTEGRAÇÃO (Classroom/Calendar), não
    identidade de login. `integration.service.ts` não mudou de comportamento.

AuthIdentity
  id, provider ('GOOGLE'), providerAccountId, userId
  @@unique([provider, providerAccountId])   -- esta conta Google só aponta pra 1 User
  @@unique([userId, provider])              -- 1 User só tem 1 Google vinculado

EmailToken
  id, purpose ('VERIFY_EMAIL' | 'RESET_PASSWORD'), tokenHash, expiresAt, usedAt, userId
```

Mesmo padrão já usado em Turmas (`Class` + `ClassMember`) e Publicações (`ClassPost` + `ClassPostCopy`): um registro canônico (a pessoa, `User`) e o que aponta pra ele (cada jeito dela provar quem é).

A chave de `AuthIdentity` é sempre `providerAccountId` (o `sub` do Google), **nunca o e-mail** — o Google permite trocar o e-mail de uma conta, e usar o e-mail como chave faria o vínculo se perder nessa troca. É a mesma regra que `User.googleId` já seguia antes; só mudou de coluna.

`googleId` continua na tabela, **deprecado, sem leitura, sem prazo de remoção** — rede de segurança barata contra bug de migração. `googleGrantedScopes`/`googleAccessToken` etc. não se moveram: são o crachá de acesso ao Classroom/Calendar, não prova de identidade.

Usuários existentes antes desta etapa ganharam a `AuthIdentity` correspondente numa migração de dado (`20260815005500_auth_backfill_google_identities`), dentro de uma transação que confere `COUNT(users com googleId) = COUNT(auth_identities)` antes de aceitar — se divergir, a migração inteira é revertida.

### Os sete fluxos

**1 — Cadastro.** `POST /auth/register` (nome, e-mail, senha) → e-mail já em uso → `409`. Não → hash `argon2id` → cria `User` **sem** `AuthIdentity`, `emailVerifiedAt: null` → sessão emitida na hora (mesmo `issueSession` de sempre) → dashboard, sem esperar confirmação. O link de verificação é gerado e — até a Etapa 25 (envio de e-mail) existir — apenas **logado**, nunca enviado de verdade.

**2 — Login.** `POST /auth/login` (e-mail, senha) → conta inexistente OU só-Google (`passwordHash` nulo) OU senha errada → **sempre a mesma mensagem** ("E-mail ou senha inválidos") — dizer "esta conta usa Google" a quem não provou a senha é enumeração de usuário. Acerta → zera o contador de tentativas, marca `passwordClaimedAt` se ainda nulo, emite sessão.

**3/4 — Google (novo ou já vinculado)** são o mesmo código, decidido por uma função pura:

```
loginWithGoogle(code)
  → resolveGoogleLogin({ existingIdentityUserId, existingUserByEmail })
      AuthIdentity(GOOGLE, sub) existe   → LOGIN_EXISTING (Fluxo 4)
      nada existe                        → CREATE_NEW (Fluxo 3)
      User com este e-mail, verificado   → LINK_VERIFIED (Fluxo 3, auto-link)
      User com este e-mail, NÃO verif.   → BLOCKED_UNVERIFIED
```

`apps/api/src/utils/google-link-resolution.ts` — sem banco, testada por mutação (`google-link-resolution.test.ts`). `BLOCKED_UNVERIFIED` nunca vincula nem cria duplicata (o e-mail já é único): devolve `409` claro, pedindo login por senha ou "esqueci minha senha".

O vínculo automático por e-mail (`LINK_VERIFIED`) acontece **sem tela de confirmação** — mas só quando `emailVerifiedAt` já está preenchido.

**6 — Google com e-mail diferente**, ao vincular uma conta já autenticada: bloqueado, sempre. **7 — Google já vinculado a outro usuário**: o próprio `@@unique([provider, providerAccountId])` do banco impede duas linhas para a mesma conta Google; o service traduz a violação em `409`.

**5 — Vincular Google numa conta já logada.** `POST /auth/me/link/google` devolve a URL de consentimento (só escopos de identidade — vincular não mexe no acesso ao Classroom/Calendar); o frontend navega. O `state` ganha o prefixo `link:`, e o callback usa isso para diferenciar de um login comum. Como a navegação completa até o Google e de volta **perde qualquer estado em memória do frontend**, o callback identifica "quem estava logado quando isto começou" pelo **cookie de refresh** — o mesmo mecanismo de `POST /auth/refresh`, só que sem rotacionar. `DELETE /auth/me/link/google` nunca remove o último método de login: recusa se a conta não tiver senha.

### O risco de sequestro por e-mail (R1) e como fica fechado

Categoria conhecida como ***pre-hijacking***: alguém cadastra `victima@gmail.com` com uma senha escolhida por ele (sem ser dono da caixa de entrada); se a vítima real depois clicar em "Continuar com Google" com esse e-mail, um auto-link ingênuo vincularia a conta Google real à conta-senha do atacante.

Duas camadas fecham o caso por completo:

1. `emailVerifiedAt` precisa estar preenchido para a conta ser elegível ao auto-link — fecha o caso ingênuo (ninguém verificou).
2. **`passwordClaimedAt`** — setado só no **primeiro login por senha bem-sucedido**, nunca no cadastro. Se o Google linkar numa conta cujo e-mail foi verificado mas cuja senha **nunca** foi usada para entrar, a senha é **apagada do banco** (`userRepository.clearPassword`) no ato do link. Fecha a janela mesmo se o atacante induzir a vítima a clicar num link de verificação: verificar o e-mail só prova que a mensagem chegou, não que a senha cadastrada pertence a quem clicou.

Por que `passwordClaimedAt` não pode ser setado no cadastro: se fosse, o cenário acima voltaria a ser explorável — o atacante "reivindicaria" a própria senha ao criar a conta, e um auto-link posterior preservaria essa senha em vez de invalidá-la.

Redefinir a senha via token de e-mail (Fluxo 9) tem o efeito inverso e fecha a mesma lacuna pelo outro lado: completar essa redefinição marca `emailVerifiedAt` **e** `passwordClaimedAt` juntos — é uma prova mais forte que um simples clique de verificação (exige controlar a caixa de entrada **e** escolher a senha nova), e dá à vítima real um caminho de autoatendimento para retomar um e-mail ocupado.

Verificado por teste de integração contra o banco real reproduzindo o ataque completo: conta ocupada → verificação sem login → decisão `LINK_VERIFIED` com `invalidatePassword: true` → senha efetivamente `null` no banco depois.

### Outros riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R2 | Força bruta distribuída (várias origens, mesma conta) | Limite **por conta** (`failedLoginAttempts`/`lockedUntil`, 5 tentativas → 15 min de bloqueio) **além** do limite por IP (`passwordAuthRateLimiter`, 20 req/15min) — um pega o que o outro não alcança |
| R3 | Enumeração de usuário | Login e "esqueci a senha" sempre respondem a mesma coisa, exista ou não a conta. Cadastro é exceção deliberada: dizer "e-mail já cadastrado" ali é esperado e necessário |
| R4 | Senha fraca | Só comprimento mínimo (8, sem teto de complexidade artificial) — orientação atual do NIST SP 800-63B |
| R5 | Migração perder/duplicar usuário | Backfill com transação + conferência de contagem (ver acima) |
| R6 | Recuperação de senha depende de e-mail, que ainda não existe (Etapa 25) | O fluxo é **code-complete**: gera e grava o token normalmente, mas o link só é logado, nunca enviado. Liga de verdade quando o envio existir |
| R7 | `argon2id` nativo em ambiente serverless (Vercel) | Prisma já exige runtime Node (não Edge); confirmar no primeiro deploy que o binário prebuilt do `argon2` cobre o runtime da Vercel — se houver problema de build, `bcrypt`/`bcryptjs` são plano B sem redesenhar nada além de `utils/password.ts` |

### Sessões e troca de senha

Trocar ou redefinir a senha **encerra as demais sessões ativas** — um refresh token roubado em outro dispositivo não sobrevive ao motivo mais comum de alguém trocar a senha. `refreshTokenRepository.revokeAllForUser(userId, exceptTokenHash?)` recebe o hash do refresh token do **próprio** dispositivo que fez a troca (lido do cookie, que viaja em qualquer rota sob `/api/v1/auth`) e o preserva — só as sessões alheias caem. Na redefinição via e-mail (Fluxo 9) não há sessão "atual" a preservar: tudo é revogado, e uma sessão nova é emitida do zero.

### Métodos de login (Configurações → Conta)

```
GET    /auth/me/login-methods   → { hasPassword, emailVerified, linkedProviders }
POST   /auth/me/link/google     -- Fluxo 5
DELETE /auth/me/link/google     -- desvincula (recusa se não houver senha)
POST   /auth/me/password        -- "Adicionar senha" (conta só-Google)
PATCH  /auth/me/password        -- trocar senha (pede a senha atual)
```

### Endpoints (Etapa 26)

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Cadastro por e-mail e senha (Fluxo 1) |
| POST | `/auth/login` | — | Login por e-mail e senha (Fluxo 2) |
| POST | `/auth/forgot-password` | — | Gera o token de redefinição (resposta sempre genérica) |
| POST | `/auth/reset-password` | — | Conclui a redefinição via token |
| POST | `/auth/verify-email` | — | Confirma o e-mail via token do cadastro |
| GET | `/auth/me/login-methods` | Bearer | Métodos de login da conta |
| POST | `/auth/me/link/google` | Bearer | URL de consentimento para vincular o Google |
| DELETE | `/auth/me/link/google` | Bearer | Desvincula o Google |
| POST | `/auth/me/password` | Bearer | Define a primeira senha |
| PATCH | `/auth/me/password` | Bearer | Troca a senha |

Todas as rotas públicas acima (registro, login, esqueci/redefinir senha, verificação) dividem o limite `passwordAuthRateLimiter` (20 req/15min por IP) — contador **próprio**, separado do `authRateLimiter` que cobre só o fluxo Google.

