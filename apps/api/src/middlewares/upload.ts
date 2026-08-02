import { extname } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ALLOWED_UPLOAD_EXTENSIONS } from '@painel/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Recepcao de arquivos.
 *
 * Usamos `memoryStorage` de proposito. Com `diskStorage` o multer grava o
 * arquivo ANTES de qualquer validacao nossa - rejeitar depois deixaria lixo no
 * disco a cada tentativa invalida. Em memoria, quem decide se os bytes chegam
 * ao storage e o service, depois de validar tudo. O teto de tamanho torna o
 * custo de RAM previsivel.
 */

const allowedExtensions = new Set<string>(ALLOWED_UPLOAD_EXTENSIONS);

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    // Campos de texto do multipart (name, subjectId...). Um teto baixo evita
    // que um cliente inflate a requisicao com metadados.
    fields: 12,
    fieldSize: 4096,
  },
  fileFilter(_req, file, callback) {
    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(
        AppError.badRequest(
          `Extensão não permitida${extension ? `: ${extension}` : ''}. Aceitos: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`,
        ),
      );
      return;
    }

    callback(null, true);
  },
});

/** Traduz os erros do multer para AppError antes do handler global. */
function toAppError(error: unknown): unknown {
  if (!(error instanceof MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return AppError.badRequest(`O arquivo excede o limite de ${env.MAX_UPLOAD_SIZE_MB} MB`);

    case 'LIMIT_FILE_COUNT':
      return AppError.badRequest('Envie um arquivo por vez');

    case 'LIMIT_UNEXPECTED_FILE':
      return AppError.badRequest('Campo de arquivo inesperado. Use o campo "file"');

    default:
      return AppError.badRequest('Não foi possível processar o envio');
  }
}

/**
 * Corrige a codificacao do nome do arquivo.
 *
 * O busboy (por baixo do multer) le o `filename` do multipart como latin-1,
 * seguindo a RFC 7578. Um arquivo chamado "Introducao.pdf" com cedilha chega
 * como "IntroduÃ§Ã£o.pdf" - os bytes UTF-8 lidos um a um como latin-1. Reverter
 * a leitura devolve o texto original.
 */
function decodeOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}

/** Middleware de upload de arquivo unico, no campo `file`. */
export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  uploader.single('file')(req, res, (error: unknown) => {
    if (error) {
      next(toAppError(error));
      return;
    }

    if (req.file) req.file.originalname = decodeOriginalName(req.file.originalname);

    next();
  });
}
