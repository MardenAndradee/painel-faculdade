'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { ALLOWED_UPLOAD_EXTENSIONS } from '@painel/shared';
import { useUploadClassMaterial } from '@/hooks/use-class-materials';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClassMaterialUploadDropzoneProps {
  classId: string;
  maxSizeMb?: number;
}

const ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.join(',');

/** Area de envio por arraste ou clique - mesmo padrao de `UploadDropzone`, para materiais da turma. */
export function ClassMaterialUploadDropzone({
  classId,
  maxSizeMb = 25,
}: ClassMaterialUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const uploadMaterial = useUploadClassMaterial(classId);

  const sendAll = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;

      setProgress({ done: 0, total: files.length });

      for (const [index, file] of files.entries()) {
        try {
          await uploadMaterial.mutateAsync({ file });
        } catch {
          // O toast de erro vem do hook. Seguimos para o proximo arquivo: um
          // PDF corrompido no meio do lote nao pode cancelar os outros.
        }

        setProgress({ done: index + 1, total: files.length });
      }

      setProgress(null);
    },
    [uploadMaterial],
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
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
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
          event.target.value = '';
        }}
      />

      {isBusy ? (
        <>
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium" aria-live="polite">
            Enviando {progress.done} de {progress.total}…
          </p>
        </>
      ) : (
        <>
          <div className="rounded-full border bg-background p-2.5">
            <Upload className="size-4 text-muted-foreground" aria-hidden />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Arraste arquivos aqui</p>
            <p className="text-xs text-muted-foreground">
              Visível para toda a turma · até {maxSizeMb} MB cada
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
