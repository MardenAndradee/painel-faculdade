import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { ModuleRouteGuard } from '@/components/module-route-guard';

/**
 * Layout das rotas autenticadas.
 *
 * O AuthGuard vem por fora do shell: sem sessao confirmada, nem a navegacao
 * chega a ser renderizada. O ModuleRouteGuard vem por dentro: bloqueia so o
 * conteudo da pagina quando o modulo esta desativado, mantendo Sidebar e
 * Navbar visiveis durante o redirect.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>
        <ModuleRouteGuard>{children}</ModuleRouteGuard>
      </AppShell>
    </AuthGuard>
  );
}
