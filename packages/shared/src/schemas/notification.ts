import { z } from 'zod';
import { paginationQuerySchema } from '../common.js';
import type { NotificationPriority, NotificationType } from '../enums.js';

/**
 * Contrato da central de notificacoes (Etapa 19).
 *
 * As notificacoes sao geradas SOB DEMANDA, na propria listagem - o projeto nao
 * tem worker nem fila, e um cron so para isso seria infraestrutura nova para
 * uma varredura que leva milissegundos. Mesmo principio do `useAutoSync`: quem
 * decide o que precisa existir e o servidor, na hora em que alguem pergunta.
 */

/**
 * `NotificationType` e `NotificationPriority` espelham o schema do Prisma e
 * moram em `enums.ts`, com os demais. Aqui ficam so os rotulos e o formato dos
 * payloads. A prioridade mapeia as variantes de `Badge` que ja existem na
 * interface - nenhuma cor nova.
 */
export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  URGENT: 'Urgente',
  ATTENTION: 'Atenção',
  INFO: 'Informativo',
  DONE: 'Concluído',
};

/** Entidade que originou a notificacao, usada para navegar ao clicar. */
export const NOTIFICATION_ENTITY_TYPES = [
  'SUBJECT',
  'ASSIGNMENT',
  'EXAM',
  'CALENDAR_EVENT',
  'CLASS_ANNOUNCEMENT',
] as const;

export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  /** `null` enquanto nao lida - o que alimenta o indicador do sino. */
  readAt: string | null;
  createdAt: string;
}

export const notificationQuerySchema = paginationQuerySchema.extend({
  /** Só as não lidas, para quem quer o essencial. */
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1'),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export interface UnreadCount {
  unread: number;
}
