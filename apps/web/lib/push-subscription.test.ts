import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './push-subscription';

// Par de teste gerado com `npx web-push generate-vapid-keys` - mesmo formato
// que a aplicação de fato recebe via NEXT_PUBLIC_VAPID_PUBLIC_KEY.
const SAMPLE_VAPID_PUBLIC_KEY =
  'BLkTiT2D61jNv-tLJ4wM8Sst8AXF9C8MF6syCV_yhSLSz7fPU4II5BEyYHLfv7kLdU5EO7aRlu0_t9EPMpHo2ys';

describe('urlBase64ToUint8Array', () => {
  it('decodifica uma chave VAPID real para os 65 bytes de uma chave publica P-256 nao comprimida', () => {
    const bytes = urlBase64ToUint8Array(SAMPLE_VAPID_PUBLIC_KEY);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    // 0x04 marca "ponto nao comprimido" no formato SEC1 - todo P-256 gerado
    // pelo web-push comeca assim.
    expect(bytes[0]).toBe(4);
  });

  it('troca os caracteres de base64url (-, _) pelos de base64 padrao (+, /) antes de decodificar', () => {
    // "--__" em base64url corresponde a "++//" em base64 padrao.
    const urlSafe = urlBase64ToUint8Array('--__');
    const standard = Uint8Array.from(Buffer.from('++//', 'base64'));

    expect(urlSafe).toEqual(standard);
  });

  it('preenche o padding ausente antes de decodificar (base64url não usa "=")', () => {
    // "QQ" (2 chars) decodifica para 1 byte só com o padding "==" completado.
    expect(urlBase64ToUint8Array('QQ')).toEqual(Uint8Array.from([65]));
  });
});
