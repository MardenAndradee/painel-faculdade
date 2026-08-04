/**
 * Validacao de conteudo por assinatura binaria (magic bytes).
 *
 * O cliente pode mentir sobre a extensao/MIME do arquivo, entao a unica forma
 * confiavel de saber o que foi de fato enviado e olhar os primeiros bytes.
 * Formatos texto puro (txt/md/csv/rtf) nao tem assinatura confiavel e por isso
 * sao aceitos sem checagem adicional.
 */

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const GIF = Buffer.from('GIF8');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const OLE_COMPOUND = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const RTF = Buffer.from('{\\rtf1');

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return (
    buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
  );
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function isZipBased(buffer: Buffer): boolean {
  return startsWith(buffer, ZIP) || startsWith(buffer, ZIP_EMPTY);
}

/** Extensoes sem assinatura binaria confiavel: qualquer conteudo e aceito. */
const UNVERIFIABLE_EXTENSIONS = new Set(['.txt', '.md', '.csv']);

const VALIDATORS: Record<string, (buffer: Buffer) => boolean> = {
  '.pdf': (buffer) => startsWith(buffer, PDF),
  '.png': (buffer) => startsWith(buffer, PNG),
  '.jpg': (buffer) => startsWith(buffer, JPEG),
  '.jpeg': (buffer) => startsWith(buffer, JPEG),
  '.gif': (buffer) => startsWith(buffer, GIF),
  '.webp': isWebp,
  '.svg': (buffer) => buffer.subarray(0, 512).toString('utf8').trim().startsWith('<'),
  '.zip': isZipBased,
  '.pptx': isZipBased,
  '.docx': isZipBased,
  '.xlsx': isZipBased,
  '.odt': isZipBased,
  '.ods': isZipBased,
  '.odp': isZipBased,
  '.ppt': (buffer) => startsWith(buffer, OLE_COMPOUND),
  '.doc': (buffer) => startsWith(buffer, OLE_COMPOUND),
  '.xls': (buffer) => startsWith(buffer, OLE_COMPOUND),
  '.rtf': (buffer) => startsWith(buffer, RTF),
};

/** True se o conteudo do arquivo bate com a assinatura esperada para a extensao. */
export function contentMatchesExtension(buffer: Buffer, extension: string): boolean {
  const ext = extension.toLowerCase();

  if (UNVERIFIABLE_EXTENSIONS.has(ext)) return true;

  const validator = VALIDATORS[ext];

  return validator ? validator(buffer) : false;
}
