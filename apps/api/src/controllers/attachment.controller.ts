import type { Request, Response } from 'express';
import type { AttachmentQuery, UploadAttachmentInput } from '@painel/shared';
import { attachmentService } from '../services/attachment.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { AppError } from '../utils/app-error.js';
import { created, noContent, ok, paginated } from '../utils/http-response.js';

/** Camada HTTP de materiais. */

/**
 * Monta o `Content-Disposition`.
 *
 * O nome ja chega sanitizado do service, mas o cabecalho ainda precisa da
 * versao `filename*` em UTF-8: acentos crus quebram o parsing em varios
 * clientes, e o `filename` simples fica como reserva em ASCII.
 */
function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const attachmentController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    paginated(res, await attachmentService.list(user.id, req.query as unknown as AttachmentQuery));
  },

  async summary(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await attachmentService.summary(user.id));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await attachmentService.getById(user.id, req.params.id as string));
  },

  async upload(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    if (!req.file) throw AppError.badRequest('Envie um arquivo no campo "file"');

    created(
      res,
      await attachmentService.upload(user.id, req.file, req.body as UploadAttachmentInput),
    );
  },

  async createLink(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(res, await attachmentService.createLink(user.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await attachmentService.update(user.id, req.params.id as string, req.body));
  },

  /**
   * Entrega o arquivo.
   *
   * Sempre como anexo e sempre com `nosniff`: servir inline permitiria que um
   * HTML ou SVG enviado por um usuario executasse script no dominio da API. A
   * pre-visualizacao no frontend usa blob local, nao o corpo desta resposta
   * renderizado diretamente.
   */
  async download(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    const file = await attachmentService.openForDownload(user.id, req.params.id as string);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(file.fileName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');

    if (file.sizeBytes !== null) res.setHeader('Content-Length', String(file.sizeBytes));

    file.stream.on('error', (error) => res.destroy(error));
    file.stream.pipe(res);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    await attachmentService.remove(user.id, req.params.id as string);
    noContent(res);
  },
};
