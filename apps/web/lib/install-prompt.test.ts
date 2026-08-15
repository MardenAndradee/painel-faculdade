import { describe, expect, it } from 'vitest';
import { isIOSUserAgent, resolveInstallCardMode } from './install-prompt';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0';
const DESKTOP_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15';

describe('isIOSUserAgent', () => {
  it('reconhece iPhone/iPad/iPod pelo user agent', () => {
    expect(isIOSUserAgent(IPHONE_UA)).toBe(true);
  });

  it('reconhece iPad no iOS 13+ (se anuncia como Mac) só com toque', () => {
    expect(isIOSUserAgent(IPAD_UA, 5)).toBe(true);
  });

  it('não confunde um Mac de mesa de verdade (sem toque) com iPad', () => {
    expect(isIOSUserAgent(DESKTOP_MAC_UA, 0)).toBe(false);
  });

  it('não reconhece Android', () => {
    expect(isIOSUserAgent(ANDROID_UA)).toBe(false);
  });
});

describe('resolveInstallCardMode', () => {
  it('não mostra nada quando já está em standalone', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: true,
        isIOS: false,
        canPromptInstall: true,
        dismissed: false,
      }),
    ).toBe('hidden');
  });

  it('não mostra nada quando o usuário já dispensou', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: false,
        isIOS: true,
        canPromptInstall: false,
        dismissed: true,
      }),
    ).toBe('hidden');
  });

  it('mostra o botão quando beforeinstallprompt disparou (Chrome/Edge)', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: false,
        isIOS: false,
        canPromptInstall: true,
        dismissed: false,
      }),
    ).toBe('button');
  });

  it('prioriza o botão real sobre as instruções manuais quando os dois são possíveis', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: false,
        isIOS: true,
        canPromptInstall: true,
        dismissed: false,
      }),
    ).toBe('button');
  });

  it('mostra instruções manuais no iOS, que nunca dispara beforeinstallprompt', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: false,
        isIOS: true,
        canPromptInstall: false,
        dismissed: false,
      }),
    ).toBe('ios-instructions');
  });

  it('não mostra botão falso em navegadores sem nenhum dos dois sinais (ex.: Firefox desktop)', () => {
    expect(
      resolveInstallCardMode({
        isStandalone: false,
        isIOS: false,
        canPromptInstall: false,
        dismissed: false,
      }),
    ).toBe('hidden');
  });
});
