/**
 * Decisao de vinculo do login por Google (Etapa 26 - autenticacao
 * e-mail+senha, Fluxos 3/4/6 do plano).
 *
 * Funcao pura, sem banco - o service so decide O QUE fazer; aqui mora a
 * decisao de QUAL caminho tomar, testavel sem subir Postgres. E o ponto mais
 * sensivel de todo o plano: uma regra errada aqui e um jeito de sequestrar a
 * conta de outra pessoa (risco R1, "pre-hijacking" - ver
 * docs/modules/autenticacao.md).
 *
 * Quatro desfechos possiveis:
 *
 * - LOGIN_EXISTING: ja existe AuthIdentity(GOOGLE, sub) - e a mesma pessoa
 *   entrando de novo (Fluxo 4).
 * - CREATE_NEW: nao existe AuthIdentity nem User com este e-mail - conta nova
 *   (Fluxo 3, caso comum).
 * - LINK_VERIFIED: nao existe AuthIdentity, mas ja existe User com este
 *   e-mail E ele confirmou o proprio e-mail - vincula (Fluxo 3, auto-link).
 *   `invalidatePassword` diz se a senha existente precisa ser derrubada (ver
 *   `passwordClaimedAt` abaixo).
 * - BLOCKED_UNVERIFIED: existe User com este e-mail mas ele NUNCA confirmou -
 *   nao vincula (fecharia a porta pro R1 ingenuo) nem cria outro (o e-mail ja
 *   e unico) - devolve erro claro em vez de estourar violacao de constraint.
 *
 * `invalidatePassword` e o refinamento que fecha R1 por completo: verificar o
 * e-mail so prova que a pessoa recebeu UMA mensagem, nao que a senha
 * cadastrada e dela. So depois que a propria senha foi usada com sucesso ao
 * menos uma vez (`passwordClaimedAt` preenchido) ela e tratada como "provada
 * pelo dono de verdade". Se o Google linkar antes disso, a senha antiga -
 * possivelmente escolhida por quem so queria ocupar o e-mail - e descartada.
 */

export interface ExistingUserByEmail {
  id: string;
  emailVerifiedAt: Date | null;
  passwordClaimedAt: Date | null;
}

export type GoogleLinkDecision =
  | { kind: 'LOGIN_EXISTING'; userId: string }
  | { kind: 'CREATE_NEW' }
  | { kind: 'LINK_VERIFIED'; userId: string; invalidatePassword: boolean }
  | { kind: 'BLOCKED_UNVERIFIED'; userId: string };

export function resolveGoogleLogin(input: {
  /** Id do usuario dono de AuthIdentity(GOOGLE, sub), se ja existir. */
  existingIdentityUserId: string | null;
  /** Usuario com este e-mail via outro metodo (tipicamente senha), se existir. */
  existingUserByEmail: ExistingUserByEmail | null;
}): GoogleLinkDecision {
  if (input.existingIdentityUserId) {
    return { kind: 'LOGIN_EXISTING', userId: input.existingIdentityUserId };
  }

  const user = input.existingUserByEmail;

  if (!user) {
    return { kind: 'CREATE_NEW' };
  }

  if (!user.emailVerifiedAt) {
    return { kind: 'BLOCKED_UNVERIFIED', userId: user.id };
  }

  return {
    kind: 'LINK_VERIFIED',
    userId: user.id,
    invalidatePassword: user.passwordClaimedAt === null,
  };
}

/** A conta esta temporariamente bloqueada por excesso de senhas erradas (risco R2)? */
export function isAccountLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}
