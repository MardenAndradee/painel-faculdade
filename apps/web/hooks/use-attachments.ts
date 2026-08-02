'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AttachmentQuery,
  CreateLinkAttachmentInput,
  UpdateAttachmentInput,
} from '@painel/shared';
import { attachmentService, type AttachmentTarget } from '@/services/attachment.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de materiais. */

export const attachmentKeys = {
  all: ['attachments'] as const,
  list: (query: Partial<AttachmentQuery>) => ['attachments', 'list', query] as const,
  summary: ['attachments', 'summary'] as const,
};

export function useAttachments(query: Partial<AttachmentQuery>) {
  return useQuery({
    queryKey: attachmentKeys.list(query),
    queryFn: () => attachmentService.list(query),
    // Mantem a lista anterior visivel enquanto o novo filtro carrega, em vez
    // de piscar um esqueleto a cada tecla digitada na busca.
    placeholderData: (previous) => previous,
  });
}

export function useAttachmentSummary() {
  return useQuery({
    queryKey: attachmentKeys.summary,
    queryFn: () => attachmentService.summary(),
  });
}

function useInvalidateAttachments() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
  };
}

export function useUploadAttachment() {
  const invalidate = useInvalidateAttachments();

  return useMutation({
    mutationFn: ({ file, target }: { file: File; target: AttachmentTarget & { name?: string } }) =>
      attachmentService.upload(file, target),
    onSuccess: async (attachment) => {
      await invalidate();
      toast.success(`${attachment.name} enviado`);
    },
    // A mensagem do servidor e mais util que qualquer texto generico: ela diz
    // se o problema foi extensao, tamanho ou conteudo divergente.
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível enviar o arquivo')),
  });
}

export function useCreateLinkAttachment() {
  const invalidate = useInvalidateAttachments();

  return useMutation({
    mutationFn: (data: CreateLinkAttachmentInput) => attachmentService.createLink(data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Link adicionado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível adicionar o link')),
  });
}

export function useUpdateAttachment() {
  const invalidate = useInvalidateAttachments();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAttachmentInput }) =>
      attachmentService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Material atualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useDeleteAttachment() {
  const invalidate = useInvalidateAttachments();

  return useMutation({
    mutationFn: (id: string) => attachmentService.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Material excluído');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível excluir')),
  });
}

/**
 * Baixa o arquivo e dispara o salvamento no navegador.
 *
 * O endpoint exige `Authorization`, entao nao da para simplesmente apontar um
 * `<a href>` para ele. Buscamos os bytes, criamos um object URL temporario e
 * o revogamos em seguida - deixar o URL vivo seguraria o blob em memoria.
 */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await attachmentService.download(id);
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível baixar o arquivo')),
  });
}
