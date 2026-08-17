'use client';

import { useQuery } from '@tanstack/react-query';
import { gradeConfigurationService } from '@/services/grade-configuration.service';

/**
 * Hook de configuração de notas (Etapa 17) - só leitura no frontend.
 *
 * Editar componentes/pesos, modelo de semestre e modelo padrão do usuário
 * ficaram sem UI de propósito - o app usa um padrão fixo N1/N2/N3 por
 * enquanto. O backend (rotas, serviços, propagação) continua completo, para
 * quando fizer sentido reabrir isso (ex.: outra instituição com componentes
 * diferentes) - só a superfície de edição no frontend foi retirada.
 */
export const gradeConfigurationKeys = {
  subject: (subjectId: string) => ['grade-configuration', 'subject', subjectId] as const,
};

export function useSubjectGradeConfiguration(subjectId: string) {
  return useQuery({
    queryKey: gradeConfigurationKeys.subject(subjectId),
    queryFn: () => gradeConfigurationService.getForSubject(subjectId),
    enabled: Boolean(subjectId),
  });
}
