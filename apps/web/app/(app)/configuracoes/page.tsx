'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plug, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleSettingsPanel } from '@/components/settings/module-settings-panel';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Configurações (Etapa 29.4/29.5) - área estrutural, sempre acessível
 * independente de quais módulos estão ativos.
 *
 * "Integrações" mora aqui, não como item próprio da Sidebar: dobrou pra
 * dentro de Configurações junto do botão "Sincronizar", que saiu da Navbar.
 */

const TABS = ['modulos', 'integracoes'] as const;
type SettingsTab = (typeof TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return TABS.includes(value as SettingsTab);
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: SettingsTab = isSettingsTab(rawTab) ? rawTab : 'modulos';

  return (
    <Tabs value={tab} onValueChange={(value) => router.replace(`/configuracoes?tab=${value}`)}>
      <TabsList>
        <TabsTrigger value="modulos">
          <SlidersHorizontal className="size-4" aria-hidden />
          Módulos
        </TabsTrigger>
        <TabsTrigger value="integracoes">
          <Plug className="size-4" aria-hidden />
          Integrações
        </TabsTrigger>
      </TabsList>

      <TabsContent value="modulos" className="mt-4">
        <ModuleSettingsPanel />
      </TabsContent>

      <TabsContent value="integracoes" className="mt-4">
        <IntegrationsPanel />
      </TabsContent>
    </Tabs>
  );
}

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize quais módulos aparecem no Painel e gerencie suas integrações.
        </p>
      </div>

      {/* useSearchParams exige Suspense em páginas pré-renderizadas. */}
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
