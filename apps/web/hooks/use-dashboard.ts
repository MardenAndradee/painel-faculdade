'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardSummary } from '@painel/shared';
import { dashboardService } from '@/services/dashboard.service';

/** Chave de cache reutilizada pelas invalidacoes das proximas etapas. */
export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};

/**
 * Resumo do dashboard.
 *
 * `staleTime` curto porque prazos e contagens de atraso mudam com o tempo -
 * um cache longo mostraria "vence hoje" no dia seguinte.
 */
export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: dashboardKeys.summary,
    queryFn: () => dashboardService.getSummary(),
    staleTime: 30 * 1000,
  });
}
