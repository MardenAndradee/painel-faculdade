import type { SearchResults } from '@painel/shared';
import { httpClient } from './http-client';

export const searchService = {
  search(query: string): Promise<SearchResults> {
    return httpClient.get<SearchResults>('/search', { query: { q: query } });
  },
};
