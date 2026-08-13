import { randomUUID } from 'node:crypto';
import { EXTENSION_TO_TYPE, type AttachmentType } from '@painel/shared';

/**
 * Pecas reaproveitadas por qualquer fluxo de upload de arquivo: materiais
 * pessoais (`attachment.service`) e materiais de turma (`class-material.service`,
 * Etapa 23). O que muda entre os dois e so o dono do dado (usuario ou turma) e
 * a regra de quem pode excluir - a validacao de conteudo, o mapeamento de tipo
 * e o nome de exibicao sao exatamente os mesmos.
 */

/**
 * Tipos que o navegador exibe com seguranca dentro da aplicacao.
 *
 * SVG fica de fora de proposito: e XML e pode carregar script, entao exibi-lo
 * inline no nosso dominio seria XSS armazenado. SVG continua aceito no upload,
 * mas sempre desce como download.
 */
export const PREVIEWABLE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** MIME confiavel derivado da extensao, ja que o do cliente nao vale nada. */
export const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
};

export function typeFromExtension(extension: string): AttachmentType {
  return EXTENSION_TO_TYPE[extension.toLowerCase()] ?? 'OTHER';
}

export function isPreviewable(mimeType: string | null): boolean {
  return mimeType !== null && PREVIEWABLE_MIME_TYPES.has(mimeType);
}

/** Intervalo de controle ASCII (0x00-0x1F e 0x7F), fora de uma classe literal para nao disparar o lint de regex de controle. */
const CONTROL_CHARS = `${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}`;
const FORBIDDEN_NAME_CHARS = new RegExp(`[${CONTROL_CHARS}"\\\\/]+`, 'g');

/**
 * Limpa o nome exibido.
 *
 * Este valor NUNCA vira caminho em disco - a chave de storage e gerada por nos.
 * A sanitizacao aqui serve para o cabecalho `Content-Disposition` e para a
 * interface: barras e caracteres de controle quebrariam o header e poderiam
 * ser usados para forjar um segundo cabecalho.
 */
export function sanitizeDisplayName(name: string): string {
  const cleaned = name.replace(FORBIDDEN_NAME_CHARS, ' ').replace(/\s+/g, ' ').trim();

  return cleaned.slice(0, 200) || 'arquivo';
}

/** Chave no storage: prefixo dado pelo chamador (usuario ou turma), particao por mes, nome aleatorio. */
export function buildStorageKey(prefix: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return `${prefix}/${year}/${month}/${randomUUID()}${extension}`;
}
