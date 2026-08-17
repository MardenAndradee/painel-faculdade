# Janela de tolerância na detecção de reuso do refresh token

> **Só análise e plano — nada foi implementado.** Nenhum arquivo alterado.
> A implementação começa na Etapa 33.1, após aprovação.

## Problema

Achado nesta conversa, a partir de um relato real: logar num aparelho às
vezes derruba a sessão de outro aparelho já logado, mesmo sem nenhum ataque
de verdade envolvido — "quando loga em um lugar, desloga no outro".

A causa está em `authService.refreshSession` (`apps/api/src/services/auth.service.ts:634`):

```ts
if (record.revokedAt) {
  logger.warn('Reuso de refresh token detectado', { userId: record.userId });
  await refreshTokenRepository.revokeAllForUser(record.userId); // derruba TODOS os aparelhos
  throw new AppError('Sessao comprometida. Faca login novamente.', 401, ...);
}
```

Cada `POST /auth/refresh` **revoga** o token apresentado e emite um par novo
(rotação). Se o mesmo token revogado aparecer de novo, o sistema assume
roubo e derruba **todas** as sessões do usuário de uma vez — em qualquer
aparelho, não só no que reapresentou o token.

**Isso é uma proteção real e correta contra roubo de token** — o problema é
que ela também dispara em um cenário 100% legítimo: o app renova a sessão
sozinho, em segundo plano, a cada ~14 minutos (`AuthProvider.scheduleRenewal`,
1 minuto antes do access token de 15 min expirar). Se o celular for
bloqueado/suspenso **no meio** dessa renovação, um cenário plausível é:

1. O servidor processa a renovação e já marca o token antigo como revogado.
2. A resposta (com o cookie novo) nunca chega a ser salva no aparelho — o
   app foi suspenso/fechado no meio do caminho, ou a rede caiu.
3. Ao reabrir, o aparelho ainda tem o cookie **antigo**, agora revogado. O
   app tenta usá-lo → o servidor vê "token revogado reapresentado" → trata
   como roubo → derruba tudo.

Não é preciso nem um segundo aparelho pra isso acontecer sozinho no mesmo
celular — mas com dois aparelhos logados ao mesmo tempo, o estrago
("desloga no outro") fica visível na hora.

## Mecânica proposta: janela de tolerância

Em vez de tratar **qualquer** reaparecimento de um token revogado como
roubo, dar um intervalo curto de tolerância a partir do momento exato da
revogação. Dentro dessa janela, é muito mais provável ser a mesma rotação
legítima batendo de novo (resposta perdida, retry de rede) do que um
ataque de verdade — um atacante capaz de interceptar e reusar um token
revogado em poucos segundos já teria comprometido a sessão de formas mais
graves, e esse é exatamente o trade-off que provedores OAuth de mercado já
assumem com esse mesmo padrão.

```
refreshSession(token, now = new Date())
  record = acha pelo hash do token

  se record.revokedAt existir:
    elapsed = now - record.revokedAt

    se elapsed > JANELA_TOLERANCIA:
      // comportamento atual, inalterado - reuso de verdade
      revogar TODAS as sessoes do usuario
      lançar "Sessao comprometida"

    senao:
      // dentro da janela - provavel retry da mesma rotacao legitima
      emitir uma sessao nova, SEM revogar o registro de novo
      (revogar de novo resetaria o revokedAt e estenderia a janela
      indefinidamente - por isso o registro tem que ficar intocado)
      retorna a sessao nova

  segue o fluxo atual (expiresAt, revoga o registro, emite sessao nova)
```

O ponto chave: dentro da janela, o registro antigo **não é tocado de novo**
— continua com o `revokedAt` original. Isso limita a tolerância a uma
"perdoada" por token, de forma natural: uma segunda reapresentação do mesmo
token, mesmo que rápida, já vai estar fora da janela medida a partir da
revogação original (a menos que aconteça dentro do mesmo intervalo curto,
caso em que também é perdoada — sem risco adicional, ainda é o mesmo
evento de rotação original se repetindo).

Efeito colateral aceitável: a sessão emitida no PRIMEIRO retry legítimo
(a que nunca chegou ao aparelho) fica órfã no banco — ninguém nunca vai
usá-la, e ela expira sozinha como qualquer sessão (ou é limpa por
`refreshTokenRepository.deleteExpired`, que já roda hoje). Não é risco de
segurança, só uma linha extra que não faz mal.

## Decisão a confirmar

| # | Pergunta | Proposta |
| --- | --- | --- |
| 1 | Duração da janela de tolerância | **30 segundos.** Curto o bastante pra não abrir uma brecha real de segurança (um atacante replayando um token roubado em até 30s de uma rotação legítima é um cenário raro, e mesmo capturando o token teria que agir quase em tempo real); longo o bastante pra cobrir reconexão de rede instável e suspensão de app em segundo plano no mobile. Ajustável por uma constante só, sem mexer na lógica. |

## Plano por etapas

### Etapa 33.1 — Backend: janela de tolerância na rotação

**Objetivo.** `refreshSession` para de derrubar todas as sessões quando o
token revogado reaparece dentro da janela de tolerância.

**Banco.** Nenhuma migration — usa o `revokedAt` que já existe em
`RefreshToken`.

**Backend.**
- Função pura nova `isWithinReuseGrace(revokedAt: Date, now: Date, graceMs: number): boolean`
  (local a `auth.service.ts` ou extraída pra um utilitário, seguindo o
  padrão de `notification-rules.ts`/`semester-period.ts` - regra pura,
  testável sem banco, com "agora" injetado).
- `refreshSession` ganha um parâmetro opcional `now = new Date()` (mesmo
  padrão de `notificationService.generatePending(userId, now)`), pra dar
  pra testar as bordas da janela sem mexer no relógio da máquina.
- Novo branch dentro do `if (record.revokedAt)`: dentro da janela, loga em
  `info` (não `warn` - não é mais um evento suspeito) e emite uma sessão
  nova via `issueSession`, sem chamar `revoke()` de novo nesse registro.
  Fora da janela, comportamento atual inalterado (`revokeAllForUser` +
  erro).

**Riscos.** Reduzir de propósito o rigor de uma proteção de segurança -
mitigado pela janela ser curta (30s) e pelo comportamment fora da janela
continuar idêntico ao de hoje. Nenhuma mudança de contrato da API (mesmo
endpoint, mesmo formato de resposta em ambos os casos).

**Testes.** Unidade de `isWithinReuseGrace` cobrindo a borda exata dos 30s
(29.9s dentro, 30.1s fora), com mutação. Integração contra o servidor
local: token válido → renova normal (inalterado); token revogado há 5s →
recebe sessão nova, nenhuma outra sessão é derrubada; token revogado há 5s
reapresentado DE NOVO (mesmo token, 2ª vez) → ainda dentro da janela
original, continua sendo perdoado; token revogado há 40s → comportamento
atual, todas as sessões do usuário são derrubadas com 401.

**Aceite.** Um retry legítimo dentro de 30 segundos da própria rotação
nunca mais derruba sessões de outros aparelhos. Reuso genuíno (fora da
janela) continua sendo tratado como comprometimento, sem mudança.

### Etapa 33.2 — Frontend: reduzir a chance da corrida acontecer (opcional)

**Objetivo.** A 33.1 já resolve o sintoma relatado, tornando-o inofensivo
quando acontece. Esta etapa é complementar: reduzir a FREQUÊNCIA da
corrida em si, não obrigatória para fechar o problema.

**Frontend.** `AuthProvider` reagenda a renovação proativa com base no
evento `visibilitychange` do navegador, em vez de confiar cegamente num
`setTimeout` que pode ter ficado pausado (app em segundo plano) e disparar
tarde, logo após o app voltar ao primeiro plano - condição que aumenta a
chance de uma renovação começar bem na hora em que o app está sendo
fechado/suspenso de novo. Ao voltar a ficar visível, verifica se a
renovação agendada já deveria ter acontecido e, se sim, dispara na hora
(em vez de esperar o timer antigo).

**Riscos.** Nenhum - é só uma mudança de *timing* de quando a renovação
roda, não do mecanismo em si.

**Testes.** Verificação manual: suspender o app (trocar de aba/minimizar)
por mais de 14 minutos, voltar, confirmar que a sessão continua válida sem
pedir login.

**Aceite.** Frequência da corrida relatada cai (não elimina por completo -
uma rede pode sempre perder uma resposta -, mas reduz o quanto isso
depende de o timer ter disparado no pior momento possível).

## Documentação

Ao concluir, atualizar `docs/modules/autenticacao.md` (seção "Rotação e
detecção de reuso") explicando a janela de tolerância e o porquê.
