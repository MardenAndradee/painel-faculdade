import type { NotificationItem, PaginationMeta, UnreadCount } from '@painel/shared';
import { httpClient } from './http-client';

export const notificationService = {
  list(params: {
    page?: number;
    perPage?: number;
    unreadOnly?: boolean;
  }): Promise<{ data: NotificationItem[]; meta: PaginationMeta }> {
    return httpClient.getPaginated<NotificationItem>('/notifications', { query: { ...params } });
  },

  unreadCount(): Promise<UnreadCount> {
    return httpClient.get<UnreadCount>('/notifications/unread-count');
  },

  markAsRead(id: string): Promise<NotificationItem> {
    return httpClient.patch<NotificationItem>(`/notifications/${id}/read`);
  },

  markAllAsRead(): Promise<{ read: number }> {
    return httpClient.post<{ read: number }>('/notifications/read-all');
  },
};
