import type { Request, Response } from 'express';
import type { CreateClassMaterialLinkInput, UploadClassMaterialInput } from '@painel/shared';
import { classMaterialService } from '../services/class-material.service.js';
import { getAuthUser } from '../middlewares/authenticate.js';
import { AppError } from '../utils/app-error.js';
import { created, noContent, ok } from '../utils/http-response.js';

/** Camada HTTP de materiais da turma (Etapa 23). Sem regra de negocio. */

/** Mesmo cabecalho do download pessoal - ver `attachment.controller`. */
function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const classMaterialController = {
  async list(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classMaterialService.list(user.id, req.params.id as string));
  },

  async summary(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    ok(res, await classMaterialService.summary(user.id, req.params.id as string));
  },

  async upload(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    if (!req.file) throw AppError.badRequest('Envie um arquivo no campo "file"');

    created(
      res,
      await classMaterialService.upload(
        user.id,
        req.params.id as string,
        req.file,
        req.body as UploadClassMaterialInput,
      ),
    );
  },

  async createLink(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    created(
      res,
      await classMaterialService.createLink(
        user.id,
        req.params.id as string,
        req.body as CreateClassMaterialLinkInput,
      ),
    );
  },

  async download(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    const file = await classMaterialService.openForDownload(
      user.id,
      req.params.id as string,
      req.params.materialId as string,
    );

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

    await classMaterialService.remove(
      user.id,
      req.params.id as string,
      req.params.materialId as string,
    );
    noContent(res);
  },
};
