import type { NotificationEntityType, SearchResultItem } from '@painel/shared';

/**
 * Para onde cada item leva (Etapa 19).
 *
 * Mora no frontend, e nao no contrato da API: montar `/disciplinas/:id` e
 * conhecimento da estrutura de rotas desta aplicacao. A mesma busca serviria a
 * um app com outra navegacao sem mudar uma linha do backend.
 */

/** Nome do parametro lido por `useInitialSearchParam` nas listagens. */
export const SEARCH_PARAM = 'busca';

/**
 * Destino de um resultado da busca.
 *
 * So disciplina tem tela de detalhe. Para as demais, mandar apenas para a
 * listagem deixaria a pessoa procurando de novo o que acabou de achar - entao
 * a URL leva o TERMO, e a tela abre ja filtrada nele. Funciona justamente
 * porque as tres listagens ja buscam por texto no servidor: o item escolhido
 * fica na primeira pagina, e o campo de busca preenchido explica por que a
 * lista esta curta.
 *
 * O calendario fica de fora: ele filtra por intervalo de datas, nao por texto,
 * e forcar um recorte ali esconderia o resto da agenda.
 */
export function searchResultHref(item: SearchResultItem): string {
  switch (item.kind) {
    case 'SUBJECT':
      return `/disciplinas/${item.id}`;

    case 'ASSIGNMENT':
      return `/atividades?${SEARCH_PARAM}=${encodeURIComponent(item.title)}`;

    case 'EXAM':
      return `/provas?${SEARCH_PARAM}=${encodeURIComponent(item.title)}`;

    case 'ATTACHMENT':
      return `/materiais?${SEARCH_PARAM}=${encodeURIComponent(item.title)}`;

    case 'CALENDAR_EVENT':
      return '/calendario';
  }
}

/**
 * Destino de uma notificacao.
 *
 * Sem termo de busca, diferente da paleta: uma notificacao e sempre sobre algo
 * IMINENTE, e a lista ja abre ordenada por prazo - o item estara no topo. Uma
 * notificacao sem entidade (resumo de sincronizacao) leva as atividades, que e
 * o que ela resume.
 */
export function notificationHref(
  entityType: NotificationEntityType | null,
  entityId: string | null,
): string {
  if (entityType === 'SUBJECT' && entityId) return `/disciplinas/${entityId}`;
  if (entityType === 'EXAM') return '/provas';
  if (entityType === 'CALENDAR_EVENT') return '/calendario';
  // `entityId` é o classId, não o do aviso - não há tela de aviso isolado,
  // o clique leva ao Mural da turma (aba padrão ao abrir `/turmas/:id`).
  if (entityType === 'CLASS_ANNOUNCEMENT' && entityId) return `/turmas/${entityId}`;

  return '/atividades';
}
