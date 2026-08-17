import type { GradeConfigurationItem } from '@painel/shared';
import { httpClient } from './http-client';

/**
 * Só leitura no frontend (Etapa 17/18 editáveis ficaram sem UI de propósito -
 * padrão fixo N1/N2/N3 por enquanto). O backend continua completo, para uso
 * futuro (ex.: outra instituição com componentes diferentes).
 */
export const gradeConfigurationService = {
  getForSubject(subjectId: string): Promise<GradeConfigurationItem> {
    return httpClient.get<GradeConfigurationItem>(`/subjects/${subjectId}/grade-configuration`);
  },
};
