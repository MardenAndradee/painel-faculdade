import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/layout/app-shell';

/**
 * Layout das rotas autenticadas.
 *
 * O guard vem por fora do shell: sem sessao confirmada, nem a navegacao chega
 * a ser renderizada.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
