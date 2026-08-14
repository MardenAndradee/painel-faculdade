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

