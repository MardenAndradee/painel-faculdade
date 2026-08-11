import { z } from 'zod';

/**
 * Contrato da busca global (Etapa 19).
 *
 * Uma consulta so, agregando as cinco fontes que o usuario procura no dia a
 * dia. O resultado NAO carrega a URL de destino: montar `/disciplinas/:id` e
 * conhecimento da camada de navegacao do frontend, nao da API - a mesma busca
 * serviria a um app com outra estrutura de rotas.
 */

export const SEARCH_KINDS = [
  'SUBJECT',
  'ASSIGNMENT',
  'EXAM',
  'CALENDAR_EVENT',
  'ATTACHMENT',
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Titulo de cada grupo na paleta. */
export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  SUBJECT: 'Disciplinas',
  ASSIGNMENT: 'Atividades',
  EXAM: 'Provas',
  CALENDAR_EVENT: 'Eventos',
  ATTACHMENT: 'Materiais',
};

/** Quantos resultados cada categoria devolve - a paleta e um atalho, nao uma listagem. */
export const SEARCH_LIMIT_PER_KIND = 5;

export const searchQuerySchema = z.object({
  q: z
    .string({ error: 'Informe o que procurar' })
    .trim()
    .min(1, 'Informe o que procurar')
    .max(120, 'Busca muito longa'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchResultItem {
  /** Unico dentro do resultado: ids se repetem entre tabelas diferentes. */
  key: string;
  id: string;
  kind: SearchKind;
  title: string;
  /** Contexto de uma linha - disciplina, data, tipo de material. */
  subtitle: string | null;
  /** Cor da disciplina relacionada, quando houver. */
  color: string | null;
}

export interface SearchGroup {
  kind: SearchKind;
  items: SearchResultItem[];
}

export interface SearchResults {
  /** Devolvido de volta para que o cliente descarte respostas fora de ordem. */
  query: string;
  /** Grupos vazios ficam de fora. */
  groups: SearchGroup[];
  total: number;
}
