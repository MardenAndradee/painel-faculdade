import { describe, expect, it } from 'vitest';
import { isAccountLocked, resolveGoogleLogin } from './google-link-resolution.js';

/**
 * Testes da decisao de vinculo do login por Google (Etapa 26).
 *
 * Este e o ponto mais sensivel do plano de autenticacao e-mail+senha: uma
 * regra errada aqui e um jeito de sequestrar a conta de outra pessoa (risco
 * R1, "pre-hijacking"). Cobre os 4 desfechos possiveis e as duas bordas que
 * decidem `invalidatePassword`.
 */

describe('resolveGoogleLogin', () => {
  it('login normal quando a AuthIdentity já existe (Fluxo 4)', () => {
    const decision = resolveGoogleLogin({
      existingIdentityUserId: 'user-1',
      // Presente ou não, não importa - a identidade já resolve sozinha.
      existingUserByEmail: null,
    });

    expect(decision).toEqual({ kind: 'LOGIN_EXISTING', userId: 'user-1' });
  });

  it('cria conta nova quando nada bate (Fluxo 3, caso comum)', () => {
    const decision = resolveGoogleLogin({
      existingIdentityUserId: null,
      existingUserByEmail: null,
    });

    expect(decision).toEqual({ kind: 'CREATE_NEW' });
  });

  it('vincula automaticamente a conta verificada (Fluxo 3, exemplo do pedido)', () => {
    // Senha primeiro, e-mail confirmado, senha já usada pra entrar alguma vez.
    const decision = resolveGoogleLogin({
      existingIdentityUserId: null,
      existingUserByEmail: {
        id: 'user-2',
        emailVerifiedAt: new Date('2026-01-01'),
        passwordClaimedAt: new Date('2026-01-02'),
      },
    });

    expect(decision).toEqual({
      kind: 'LINK_VERIFIED',
      userId: 'user-2',
      invalidatePassword: false,
    });
  });

  it('vincula E invalida a senha nunca comprovada (núcleo do risco R1)', () => {
    // E-mail verificado, mas a senha JAMAIS foi usada num login bem-sucedido -
    // não é prova de que a senha pertence a quem clicou no link do e-mail.
    const decision = resolveGoogleLogin({
      existingIdentityUserId: null,
      existingUserByEmail: {
        id: 'user-3',
        emailVerifiedAt: new Date('2026-01-01'),
        passwordClaimedAt: null,
      },
    });

    expect(decision).toEqual({
      kind: 'LINK_VERIFIED',
      userId: 'user-3',
      invalidatePassword: true,
    });
  });

  it('bloqueia (não vincula, não cria) quando o e-mail nunca foi verificado', () => {
    // O caso ingênuo de pre-hijacking: alguém ocupou o e-mail com senha e
    // nunca confirmou. Criar duplicata violaria o @unique; vincular sem essa
    // trava seria o sequestro em si.
    const decision = resolveGoogleLogin({
      existingIdentityUserId: null,
      existingUserByEmail: { id: 'user-4', emailVerifiedAt: null, passwordClaimedAt: null },
    });

    expect(decision).toEqual({ kind: 'BLOCKED_UNVERIFIED', userId: 'user-4' });
  });

  it('AuthIdentity tem prioridade sobre qualquer estado do e-mail', () => {
    // Ainda que o e-mail associado esteja não-verificado, a identidade já
    // resolvida é o que importa - ela já passou por este mesmo fluxo antes.
    const decision = resolveGoogleLogin({
      existingIdentityUserId: 'user-5',
      existingUserByEmail: { id: 'user-5', emailVerifiedAt: null, passwordClaimedAt: null },
    });

    expect(decision.kind).toBe('LOGIN_EXISTING');
  });
});

describe('isAccountLocked', () => {
  const now = new Date('2026-01-01T12:00:00');

  it('não bloqueada quando nunca houve tentativa', () => {
    expect(isAccountLocked(null, now)).toBe(false);
  });

  it('bloqueada enquanto o prazo não passou', () => {
    expect(isAccountLocked(new Date('2026-01-01T12:05:00'), now)).toBe(true);
  });

  it('libera exatamente no instante do prazo', () => {
    expect(isAccountLocked(now, now)).toBe(false);
  });

  it('libera depois que o prazo passou', () => {
    expect(isAccountLocked(new Date('2026-01-01T11:55:00'), now)).toBe(false);
  });
});
