'use client';

import { useQuery } from '@tanstack/react-query';
import type { StatsPeriod } from '@painel/shared';
import { statisticsService } from '@/services/statistics.service';

/** Hook das estatisticas. */

export const statisticsKeys = {
  all: ['statistics'] as const,
  period: (period: StatsPeriod) => ['statistics', period] as const,
};

export function useStatistics(period: StatsPeriod) {
  return useQuery({
    queryKey: statisticsKeys.period(period),
    queryFn: () => statisticsService.get(period),
    // Mantem o render anterior enquanto o novo periodo carrega: trocar o
    // filtro nao pode fazer a pagina piscar um esqueleto e saltar.
    placeholderData: (previous) => previous,
  });
}
