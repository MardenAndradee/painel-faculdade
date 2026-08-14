'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { APP_MODULES, type AppModule } from '@painel/shared';
import { MODULE_DEFINITIONS } from '@/lib/modules';
import { useModuleSettings } from '@/hooks/use-module-settings';

/**
 * Acha o módulo dono da rota atual, se houver - percorre `MODULE_DEFINITIONS`
 * (todos os 12 módulos, com ou sem item próprio na Sidebar) em vez de
 * `navigation.ts`, porque `EXAM_PREP`/`FLASHCARDS` não têm item de nav mas
 * ainda precisam de guarda de rota.
 */
function findModuleForPath(pathname: string): AppModule | null {
  for (const module of APP_MODULES) {
    const route = MODULE_DEFINITIONS[module].route;

    if (pathname === route || pathname.startsWith(`${route}/`)) return module;
  }

  return null;
}

/**
 * Bloqueia acesso direto (URL digitada, favorito) a uma rota de módulo
 * desativado - redireciona para o Dashboard com aviso, nunca 404 (o dado não
 * deixou de existir, só saiu da experiência principal). Ver Etapa 29.7 do
 * plano em docs/planning/modulos-configuraveis.md.
 */
export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading } = useModuleSettings();

  const module = findModuleForPath(pathname);
  const enabled =
    !module || !data || (data.find((item) => item.module === module)?.enabled ?? true);

  useEffect(() => {
    if (isLoading || !module || !data || enabled) return;

    toast.error(
      `${MODULE_DEFINITIONS[module].label} está desativado. Ative em Configurações para acessar.`,
    );
    router.replace('/dashboard');
  }, [isLoading, module, data, enabled, router]);

  // Enquanto o redirect corre, nao renderiza a pagina bloqueada - evita
  // piscar conteudo de um modulo que o usuario acabou de desativar.
  if (module && data && !enabled) return null;

  return <>{children}</>;
}
