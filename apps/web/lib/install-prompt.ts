/**
 * Regras da Etapa 28.7 (Experiência de instalação) - extraídas do hook em
 * React para virar TypeScript comum e testável (mesmo padrão de
 * `sw-runtime-caching.ts`): decide o que mostrar sem depender de `window`,
 * `navigator` nem `matchMedia`.
 */

const IOS_DEVICE_PATTERN = /iphone|ipad|ipod/i;

/**
 * iPad no iOS 13+ se anuncia como um Mac "de mesa" com suporte a toque - por
 * isso a checagem soma um segundo sinal (`maxTouchPoints`) para esse caso.
 */
export function isIOSUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  if (IOS_DEVICE_PATTERN.test(userAgent)) return true;

  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export type InstallCardMode = 'button' | 'ios-instructions' | 'hidden';

/**
 * Decide o que o card "Instalar aplicativo" mostra (R5, R6 do plano).
 *
 * - Já instalado (`isStandalone`) ou dispensado pelo usuário: nada.
 * - `beforeinstallprompt` disparou (Chrome/Edge Android e desktop): botão real.
 * - iOS sem esse evento (Safari nunca dispara, e nunca vai): instruções manuais.
 * - Nenhuma das duas coisas (ex.: Firefox desktop): nada - nunca um botão falso.
 */
export function resolveInstallCardMode(input: {
  isStandalone: boolean;
  isIOS: boolean;
  canPromptInstall: boolean;
  dismissed: boolean;
}): InstallCardMode {
  if (input.isStandalone || input.dismissed) return 'hidden';
  if (input.canPromptInstall) return 'button';
  if (input.isIOS) return 'ios-instructions';

  return 'hidden';
}
