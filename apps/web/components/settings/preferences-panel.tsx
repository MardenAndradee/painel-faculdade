'use client';

import { useTheme } from 'next-themes';
import { Bell, BellOff, Monitor, Moon, Sun } from 'lucide-react';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import { useUpdateProfile } from '@/hooks/use-update-profile';
import { toThemePreference, type NextTheme } from '@/lib/theme-preference';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const THEME_OPTIONS: Array<{ value: NextTheme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

const PUSH_STATUS_MESSAGE: Record<'unsupported' | 'denied', string> = {
  unsupported:
    'Notificações push não são suportadas neste navegador. No iPhone/iPad, exigem o app instalado na tela de início (iOS 16.4+).',
  denied:
    'As notificações foram bloqueadas para este site. Para ativar, permita notificações nas configurações do navegador.',
};

/**
 * Configurações → Preferências (Etapa 28.12).
 *
 * Junta as duas pontas soltas que o plano de PWA deixou por último: o tema
 * escolhido, que hoje só sobrevive em `localStorage` (não acompanha quem
 * troca de aparelho), e o pedido de permissão de push, que só pode
 * acontecer sob uma ação explícita como esta - nunca ao carregar a página.
 */
export function PreferencesPanel() {
  const { theme, setTheme } = useTheme();
  const updateProfile = useUpdateProfile();
  const push = usePushSubscription();

  function handleThemeChange(value: NextTheme): void {
    setTheme(value);
    updateProfile.mutate({ theme: toThemePreference(value) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tema</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sincronizado com sua conta - a mesma escolha aparece ao entrar em outro aparelho.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                aria-pressed={theme === value}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors',
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              {push.isSubscribed ? (
                <Bell className="size-5" aria-hidden />
              ) : (
                <BellOff className="size-5" aria-hidden />
              )}
            </div>

            <div className="min-w-0">
              <CardTitle className="text-base">Notificações push</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Avisa sobre prazos e provas próximas mesmo com o app fechado.
              </p>
            </div>
          </div>

          {push.status !== 'unsupported' && (
            <Switch
              checked={push.isSubscribed}
              disabled={push.isBusy || push.status === 'denied'}
              onCheckedChange={(checked) =>
                checked ? void push.subscribe() : void push.unsubscribe()
              }
              aria-label="Ativar notificações push"
            />
          )}
        </CardHeader>

        {(push.status === 'unsupported' || push.status === 'denied') && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{PUSH_STATUS_MESSAGE[push.status]}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
