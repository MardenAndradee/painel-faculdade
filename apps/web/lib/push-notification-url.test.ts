import { describe, expect, it } from 'vitest';
import { resolveNotificationUrl } from './push-notification-url';

describe('resolveNotificationUrl', () => {
  it('leva para Atividades quando a notificação é de uma atividade', () => {
    expect(resolveNotificationUrl('ASSIGNMENT')).toBe('/atividades');
  });

  it('leva para Provas quando a notificação é de uma prova', () => {
    expect(resolveNotificationUrl('EXAM')).toBe('/provas');
  });

  it('leva para o Dashboard em qualquer outro tipo (ou ausente)', () => {
    expect(resolveNotificationUrl('CLASS_ANNOUNCEMENT')).toBe('/dashboard');
    expect(resolveNotificationUrl(null)).toBe('/dashboard');
    expect(resolveNotificationUrl(undefined)).toBe('/dashboard');
  });
});
