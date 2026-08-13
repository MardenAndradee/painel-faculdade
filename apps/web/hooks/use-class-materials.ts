'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateClassMaterialLinkInput } from '@painel/shared';
import { classMaterialService } from '@/services/class-material.service';
import { errorMessage } from '@/lib/api-error';

/** Hooks de materiais da turma (Etapa 23). */

export const classMaterialKeys = {
  all: (classId: string) => ['classMaterials', classId] as const,
  list: (classId: string) => ['classMaterials', classId, 'list'] as const,
  summary: (classId: string) => ['classMaterials', classId, 'summary'] as const,
};

export function useClassMaterials(classId: string) {
  return useQuery({
    queryKey: classMaterialKeys.list(classId),
    queryFn: () => classMaterialService.list(classId),
    enabled: Boolean(classId),
  });
}

export function useClassMaterialSummary(classId: string) {
  return useQuery({
    queryKey: classMaterialKeys.summary(classId),
    queryFn: () => classMaterialService.summary(classId),
    enabled: Boolean(classId),
  });
}

function useInvalidateClassMaterials(classId: string) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: classMaterialKeys.all(classId) });
}

export function useUploadClassMaterial(classId: string) {
  const invalidate = useInvalidateClassMaterials(classId);

  return useMutation({
    mutationFn: ({ file, name }: { file: File; name?: string }) =>
      classMaterialService.upload(classId, file, name),
    onSuccess: async (material) => {
      await invalidate();
      toast.success(`${material.name} enviado`);
    },
    // A mensagem do servidor e mais util que qualquer texto generico: ela diz
    // se o problema foi extensao, tamanho ou conteudo divergente.
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível enviar o arquivo')),
  });
}

export function useCreateClassMaterialLink(classId: string) {
  const invalidate = useInvalidateClassMaterials(classId);

  return useMutation({
    mutationFn: (data: CreateClassMaterialLinkInput) =>
      classMaterialService.createLink(classId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Link adicionado');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível adicionar o link')),
  });
}

export function useRemoveClassMaterial(classId: string) {
  const invalidate = useInvalidateClassMaterials(classId);

  return useMutation({
    mutationFn: (materialId: string) => classMaterialService.remove(classId, materialId),
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
 * o revogamos em seguida.
 */
export function useDownloadClassMaterial(classId: string) {
  return useMutation({
    mutationFn: async ({ materialId, name }: { materialId: string; name: string }) => {
      const blob = await classMaterialService.download(classId, materialId);
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
