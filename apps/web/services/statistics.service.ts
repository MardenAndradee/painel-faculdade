import type { StatisticsResponse, StatsPeriod } from '@painel/shared';
import { httpClient } from './http-client';

export const statisticsService = {
  get(period: StatsPeriod): Promise<StatisticsResponse> {
    return httpClient.get<StatisticsResponse>('/statistics', { query: { period } });
  },
};
