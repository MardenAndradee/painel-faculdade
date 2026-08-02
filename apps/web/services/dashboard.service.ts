import type { DashboardSummary } from '@painel/shared';
import { httpClient } from './http-client';

export const dashboardService = {
  getSummary(): Promise<DashboardSummary> {
    return httpClient.get<DashboardSummary>('/dashboard/summary');
  },
};
