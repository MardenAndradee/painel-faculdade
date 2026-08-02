'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { AttachmentListItem } from '@painel/shared';
import { attachmentService } from '@/services/attachment.service';
import { useDownloadAttachment } from '@/hooks/use-attachments';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from '@/lib/format';

interface AttachmentPreviewProps {
  attachment: AttachmentListItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pre-visualizacao de imagens e PDFs.
 *
 * O endpoint de download exige `Authorization`, e nem `<img src>` nem
 * `<iframe src>` enviam esse cabecalho. Entao buscamos os bytes pelo cliente
 * HTTP e montamos um object URL local. O URL e revogado ao fechar - sem isso o
 * blob ficaria retido em memoria a cada material aberto.
 */
export function AttachmentPreview({ attachment, onOpenChange }: AttachmentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const download = useDownloadAttachment();

  const attachmentId = attachment?.id ?? null;

  useEffect(() => {
    if (!attachmentId) return;

    let revoked = false;
    let url: string | null = null;

    setObjectUrl(null);
    setError(null);

    attachmentService
      .download(attachmentId)
      .then((blob) => {
        // O diálogo pode ter fechado enquanto o download corria; nesse caso o
        // cleanup já rodou e criar o URL agora vazaria memória.
        if (revoked) return;

        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => setError('Não foi possível carregar a pré-visualização.'));

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId]);

  if (!attachment) return null;

  const isImage = attachment.mimeType?.startsWith('image/') ?? false;

  return (
    <Dialog open={attachment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment.name}</DialogTitle>
          <DialogDescription>
            {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] min-h-64 items-center justify-center overflow-auto rounded-lg border bg-muted/30">
          {error ? (
            <p className="p-6 text-sm text-muted-foreground">{error}</p>
          ) : !objectUrl ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          ) : isImage ? (
            /* `next/image` nao serve aqui: o otimizador precisa de uma URL que
               o servidor consiga buscar, e um object URL so existe nesta aba. */
            <img
              src={objectUrl}
              alt={attachment.name}
              className="max-h-[65vh] w-auto max-w-full object-contain"
            />
          ) : (
            <iframe
              src={objectUrl}
              title={attachment.name}
              className="h-[65vh] w-full"
              // O conteudo vem do proprio usuario, mas continua sendo um
              // documento arbitrario: sem sandbox ele poderia rodar script no
              // nosso dominio. Nenhuma permissao e concedida de volta.
              sandbox=""
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>

          <Button
            onClick={() => download.mutate({ id: attachment.id, name: attachment.name })}
            disabled={download.isPending}
          >
            <Download className="size-4" aria-hidden />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
