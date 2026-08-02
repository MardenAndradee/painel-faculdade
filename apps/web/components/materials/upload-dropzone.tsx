'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { ALLOWED_UPLOAD_EXTENSIONS } from '@painel/shared';
import { useUploadAttachment } from '@/hooks/use-attachments';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AttachmentTarget } from '@/services/attachment.service';

interface UploadDropzoneProps {
  /** Vinculo aplicado a tudo que for enviado por aqui. */
  target?: AttachmentTarget;
  maxSizeMb?: number;
}

const ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.join(',');

/**
 * Area de envio por arraste ou clique.
 *
 * Os arquivos sao enviados um a um, em sequencia. Disparar tudo em paralelo
 * deixaria a barra de progresso mentirosa e, num lote grande, poderia esbarrar
 * no limite de conexoes do navegador - o servidor tambem aceita um arquivo por
 * requisicao.
 */
export function UploadDropzone({ target, maxSizeMb = 25 }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const uploadAttachment = useUploadAttachment();

  const sendAll = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;

      setProgress({ done: 0, total: files.length });

      for (const [index, file] of files.entries()) {
        try {
          await uploadAttachment.mutateAsync({ file, target: { ...target } });
        } catch {
          // O toast de erro vem do hook. Seguimos para o proximo arquivo: um
          // PDF corrompido no meio do lote nao pode cancelar os outros.
        }

        setProgress({ done: index + 1, total: files.length });
      }

      setProgress(null);
    },
    [target, uploadAttachment],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    void sendAll([...event.dataTransfer.files]);
  };

  const isBusy = progress !== null;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      data-testid="upload-dropzone"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="Escolher arquivos"
        onChange={(event) => {
          void sendAll([...(event.target.files ?? [])]);
          // Limpa o valor para que escolher o MESMO arquivo de novo dispare o
          // evento outra vez (o navegador nao emite change para valor igual).
          event.target.value = '';
        }}
      />

      {isBusy ? (
        <>
          <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium" aria-live="polite">
            Enviando {progress.done} de {progress.total}…
          </p>
        </>
      ) : (
        <>
          <div className="rounded-full border bg-background p-3">
            <Upload className="size-5 text-muted-foreground" aria-hidden />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Arraste arquivos aqui</p>
            <p className="text-xs text-muted-foreground">
              PDF, imagens, slides, planilhas e compactados · até {maxSizeMb} MB cada
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Escolher arquivos
          </Button>
        </>
      )}
    </div>
  );
}
