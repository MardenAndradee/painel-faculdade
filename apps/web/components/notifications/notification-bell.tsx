'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import type { NotificationItem, NotificationPriority } from '@painel/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/use-notifications';
import { notificationHref } from '@/lib/entity-routes';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Cor do ponto de prioridade.
 *
 * Reaproveita os tokens de status que já existem em `globals.css` — a Etapa 19
 * não introduz cor nenhuma. 🔴 urgente, 🟡 atenção, 🔵 informativo, 🟢 feito.
 */
const PRIORITY_DOT: Record<NotificationPriority, string> = {
  URGENT: 'bg-status-overdue',
  ATTENTION: 'bg-status-pending',
  INFO: 'bg-primary',
  DONE: 'bg-status-completed',
};

/**
 * Central de notificações (Etapa 19).
 *
 * A lista só é buscada com o sino aberto; fechado, o cabeçalho consulta apenas
 * a contagem. Isso importa porque a listagem roda a varredura que gera as
 * notificações de prazo no servidor — carregá-la em toda tela seria trabalho
 * repetido que ninguém veria.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: count } = useUnreadNotificationCount();
  const { data, isLoading } = useNotifications(false, open);
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const unread = count?.unread ?? 0;
  const items = data?.data ?? [];

  const handleClick = (item: NotificationItem): void => {
    if (!item.readAt) markAsRead.mutate(item.id);

    setOpen(false);
    router.push(notificationHref(item.entityType, item.entityId));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread === 0 ? 'Notificações' : `Notificações, ${unread} não lidas`}
        >
          <Bell className="size-5" aria-hidden />

          {unread > 0 && (
            <span
              className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-status-overdue px-1 text-[10px] leading-4 font-semibold text-white tabular-nums"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>

          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todas
            </Button>
          )}
        </div>

        <div className="max-h-[min(26rem,60vh)] overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Nada por aqui"
              description="Prazos próximos e novidades do Classroom aparecem aqui."
            />
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(item)}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50',
                      !item.readAt && 'bg-accent/25',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        PRIORITY_DOT[item.priority],
                        // Lida perde o destaque, mas mantém a cor como pista
                        // do que aquilo era.
                        item.readAt && 'opacity-40',
                      )}
                      aria-hidden
                    />

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-[13px]',
                          item.readAt ? 'text-muted-foreground' : 'font-medium',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.message}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
