import { describe, expect, it } from 'vitest';
import { WebPushError } from 'web-push';
import { isGoneSubscription } from './push-errors.js';

function webPushError(statusCode: number): WebPushError {
  return new WebPushError('falha', statusCode, {}, '', 'https://push.example/x');
}

describe('isGoneSubscription', () => {
  it('reconhece 404 (inscrição não existe mais)', () => {
    expect(isGoneSubscription(webPushError(404))).toBe(true);
  });

  it('reconhece 410 (inscrição expirada)', () => {
    expect(isGoneSubscription(webPushError(410))).toBe(true);
  });

  it('não apaga em falha temporária (5xx)', () => {
    expect(isGoneSubscription(webPushError(500))).toBe(false);
  });

  it('não apaga em erro que não é do web-push', () => {
    expect(isGoneSubscription(new Error('rede fora do ar'))).toBe(false);
  });
});
