import {
  ATTACHMENT_TYPE_LABELS,
  SEARCH_KINDS,
  type SearchGroup,
  type SearchKind,
  type SearchResultItem,
  type SearchResults,
} from '@painel/shared';
import { searchRepository, type SearchHits } from '../repositories/search.repository.js';
import { moduleSettingsService } from './module-settings.service.js';

/** Regra de negocio da busca global (Etapa 19). */

/**
 * Data curta para o subtitulo ("12/03").
 *
 * Deliberadamente sem hora e sem ano: o subtitulo tem uma linha e o que
 * importa ali e reconhecer o item, nao ler a agenda.
 */
function shortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

/** Junta os pedacos de contexto disponiveis, pulando os ausentes. */
function subtitle(...parts: Array<string | null | undefined>): string | null {
  const filled = parts.filter((part): part is string => Boolean(part));

  return filled.length > 0 ? filled.join(' · ') : null;
}

function toItem(
  kind: SearchKind,
  id: string,
  title: string,
  context: string | null,
  color: string | null,
): SearchResultItem {
  // Ids se repetem entre tabelas; a chave precisa do tipo para ser unica.
  return { key: `${kind}:${id}`, id, kind, title, subtitle: context, color };
}

/** Cada fonte vira a mesma forma de resultado - a paleta nao sabe de onde veio. */
function toGroups(hits: SearchHits): SearchGroup[] {
  const byKind: Record<SearchKind, SearchResultItem[]> = {
    SUBJECT: hits.subjects.map((row) =>
      toItem('SUBJECT', row.id, row.name, subtitle(row.code), row.color),
    ),

    ASSIGNMENT: hits.assignments.map((row) =>
      toItem(
        'ASSIGNMENT',
        row.id,
        row.title,
        subtitle(
          row.subject?.name,
          row.dueDate ? `entrega ${shortDate(row.dueDate)}` : null,
          row.status === 'COMPLETED' ? 'concluída' : null,
        ),
        row.subject?.color ?? null,
      ),
    ),

    EXAM: hits.exams.map((row) =>
      toItem(
        'EXAM',
        row.id,
        row.title,
        subtitle(row.subject?.name, shortDate(row.date)),
        row.subject?.color ?? null,
      ),
    ),

    CALENDAR_EVENT: hits.calendarEvents.map((row) =>
      toItem(
        'CALENDAR_EVENT',
        row.id,
        row.title,
        subtitle(shortDate(row.startsAt), row.location, row.subject?.name),
        row.subject?.color ?? null,
      ),
    ),

    ATTACHMENT: hits.attachments.map((row) =>
      toItem(
        'ATTACHMENT',
        row.id,
        row.name,
        subtitle(ATTACHMENT_TYPE_LABELS[row.type], row.subject?.name),
        row.subject?.color ?? null,
      ),
    ),
  };

  // A ordem vem de SEARCH_KINDS para que os grupos nao dancem entre buscas.
  return SEARCH_KINDS.map((kind) => ({ kind, items: byKind[kind] })).filter(
    (group) => group.items.length > 0,
  );
}

export const searchService = {
  async search(userId: string, query: string): Promise<SearchResults> {
    const enabledModules = await moduleSettingsService.getEnabledSet(userId);

    const groups = toGroups(
      await searchRepository.findAll(userId, query, {
        subjects: enabledModules.has('SUBJECTS'),
        assignments: enabledModules.has('ASSIGNMENTS'),
        exams: enabledModules.has('EXAMS'),
        calendarEvents: enabledModules.has('CALENDAR'),
        attachments: enabledModules.has('MATERIALS'),
      }),
    );

    return {
      query,
      groups,
      total: groups.reduce((count, group) => count + group.items.length, 0),
    };
  },
};
