'use client';

import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogoutAll = async (): Promise<void> => {
    await authService.logoutAll();
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Menu da conta"
        >
          <Avatar className="size-8">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void handleLogoutAll()}>
          <MonitorSmartphone aria-hidden />
          Sair de todos os dispositivos
        </DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
