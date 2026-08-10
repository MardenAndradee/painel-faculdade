'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { GradeConfigurationInput } from '@painel/shared';
import { gradeConfigurationService } from '@/services/grade-configuration.service';
import { gradeKeys } from './use-grades';
import { subjectKeys } from './use-subjects';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/** Hooks de configuracao de notas (Etapa 17). */

export const gradeConfigurationKeys = {
  subject: (subjectId: string) => ['grade-configuration', 'subject', subjectId] as const,
  semesterTemplate: (semesterId: string) =>
    ['grade-configuration', 'semester-template', semesterId] as const,
  userDefault: ['grade-configuration', 'user-default'] as const,
  propagationPreview: (semesterId: string) =>
    ['grade-configuration', 'propagation-preview', semesterId] as const,
};

export function useSubjectGradeConfiguration(subjectId: string) {
  return useQuery({
    queryKey: gradeConfigurationKeys.subject(subjectId),
    queryFn: () => gradeConfigurationService.getForSubject(subjectId),
    enabled: Boolean(subjectId),
  });
}

export function useSemesterGradeConfigurationTemplate(semesterId: string, enabled = true) {
  return useQuery({
    queryKey: gradeConfigurationKeys.semesterTemplate(semesterId),
    queryFn: () => gradeConfigurationService.getTemplateForSemester(semesterId),
    enabled: Boolean(semesterId) && enabled,
  });
}

/** Mudar os componentes muda o peso de tudo - afeta media, projecao e dashboard. */
function useInvalidateAfterConfigChange() {
  const queryClient = useQueryClient();

  return async (subjectId: string): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gradeConfigurationKeys.subject(subjectId) }),
      queryClient.invalidateQueries({ queryKey: gradeKeys.all }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useReplaceSubjectGradeConfiguration() {
  const invalidate = useInvalidateAfterConfigChange();

  return useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: GradeConfigurationInput }) =>
      gradeConfigurationService.replaceForSubject(subjectId, data),
    onSuccess: async (_result, { subjectId }) => {
      await invalidate(subjectId);
      toast.success('Configuração de notas salva');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function useReplaceSemesterGradeConfigurationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ semesterId, data }: { semesterId: string; data: GradeConfigurationInput }) =>
      gradeConfigurationService.replaceTemplateForSemester(semesterId, data),
    onSuccess: async (_result, { semesterId }) => {
      await queryClient.invalidateQueries({
        queryKey: gradeConfigurationKeys.semesterTemplate(semesterId),
      });
      toast.success('Modelo padrão do semestre salvo');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

// --- Propagacao do modelo do semestre (Etapa 18) -------------------------------

/**
 * O que mudaria nas disciplinas ja criadas se o modelo fosse aplicado.
 *
 * `enabled` fica sob controle de quem chama porque a previa so faz sentido
 * depois de salvar o modelo - buscar antes mostraria a diferenca contra o
 * modelo antigo.
 */
export function useGradeTemplatePropagationPreview(semesterId: string, enabled: boolean) {
  return useQuery({
    queryKey: gradeConfigurationKeys.propagationPreview(semesterId),
    queryFn: () => gradeConfigurationService.previewPropagation(semesterId),
    enabled: Boolean(semesterId) && enabled,
    // Sempre refaz ao abrir: o modelo acabou de mudar.
    staleTime: 0,
  });
}

export function usePropagateGradeTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ semesterId, subjectIds }: { semesterId: string; subjectIds: string[] }) =>
      gradeConfigurationService.propagateTemplate(semesterId, subjectIds),
    onSuccess: async (result, { semesterId }) => {
      // Mexeu no peso de varias disciplinas: media, boletim e dashboard mudam.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['grade-configuration'] }),
        queryClient.invalidateQueries({ queryKey: gradeKeys.all }),
        queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
        queryClient.invalidateQueries({
          queryKey: gradeConfigurationKeys.propagationPreview(semesterId),
        }),
      ]);

      toast.success(
        result.updatedSubjects === 1
          ? 'Modelo aplicado em 1 disciplina'
          : `Modelo aplicado em ${result.updatedSubjects} disciplinas`,
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível aplicar o modelo')),
  });
}

/**
 * Modelo pessoal padrao do usuario (Etapa 19).
 *
 * Pre-preenche semestres e disciplinas novas (inclusive as importadas do
 * Classroom) quando nao ha um modelo mais especifico. Criado automaticamente
 * no primeiro login - `data` so vem `null` em contas legadas anteriores a
 * esta etapa.
 */
export function useUserDefaultGradeConfiguration(enabled = true) {
  return useQuery({
    queryKey: gradeConfigurationKeys.userDefault,
    queryFn: () => gradeConfigurationService.getUserDefault(),
    enabled,
  });
}

export function useReplaceUserDefaultGradeConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GradeConfigurationInput) =>
      gradeConfigurationService.replaceUserDefault(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: gradeConfigurationKeys.userDefault });
      toast.success('Modelo padrão salvo');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}
