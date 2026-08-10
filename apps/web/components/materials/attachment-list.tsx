'use client';

import { useState } from 'react';
import { AlertTriangle, FileStack, Loader2, RefreshCw, SearchX } from 'lucide-react';
import type { AttachmentListItem, AttachmentQuery } from '@painel/shared';
import { useAttachments, useDeleteAttachment } from '@/hooks/use-attachments';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import { AttachmentCard } from './attachment-card';
import { AttachmentEditDialog } from './attachment-edit-dialog';
import { AttachmentPreview } from './attachment-preview';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AttachmentListProps {
  params: Partial<AttachmentQuery>;
  onPageChange: (page: number) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Lista de materiais.
 *
 * Compartilhada entre a tela de Materiais e a aba da disciplina - a diferenca
 * entre elas e apenas o filtro aplicado, igual a `AssignmentList`/`ExamList`.
 * O upload/criacao de link fica com quem usa este componente, nao aqui: sao
 * duas UIs bem diferentes (dropzone vs dialogo) para caber num unico padrao.
 */
export function AttachmentList({
  params,
  onPageChange,
  hasActiveFilters,
  onClearFilters,
}: AttachmentListProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useAttachments(params);
  const deleteAttachment = useDeleteAttachment();

  const [editing, setEditing] = useState<AttachmentListItem | null>(null);
  const [previewing, setPreviewing] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState<AttachmentListItem | null>(null);

  const attachments = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar os materiais"
          description={error instanceof Error ? error.message : 'Tente novamente.'}
          action={
            <Button size="sm" onClick={() => void refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              Tentar novamente
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      {attachments.length === 0 ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum material encontrado"
              description="Nenhum resultado para os filtros aplicados."
              action={
                onClearFilters && (
                  <Button variant="outline" size="sm" onClick={onClearFilters}>
                    Limpar filtros
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              icon={FileStack}
              title="Nenhum material ainda"
              description="Arraste um arquivo para a área acima ou salve um link para começar."
            />
          )}
        </Card>
      ) : (
        <div
          className={cn(
            'grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3',
            isFetching && 'opacity-60',
          )}
        >
          {attachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              onPreview={setPreviewing}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange(meta.page - 1)}
          >
            Anterior
          </Button>

          <Badge variant="secondary">
            {meta.page} de {meta.totalPages}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange(meta.page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <AttachmentEditDialog
        attachment={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <AttachmentPreview
        attachment={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.source === 'LINK'
                ? 'O link será removido da sua lista. A página de destino não é afetada.'
                : 'O arquivo será apagado definitivamente do servidor. Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>

            <Button
              variant="destructive"
              disabled={deleteAttachment.isPending}
              onClick={async () => {
                if (!deleting) return;

                await deleteAttachment.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              {deleteAttachment.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
