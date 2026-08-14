'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Link2Off,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConnectCalendar,
  useConnectClassroom,
  useDisconnectCalendar,
  useDisconnectClassroom,
  useIntegrationStatus,
  useSyncCalendar,
  useSyncClassroom,
} from '@/hooks/use-integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GoogleIcon } from '@/components/google-icon';
import { formatRelative } from '@/lib/format';

/**
 * Configurações → Integrações (Etapa 29.5).
 *
 * Movido de `/integracoes` (rota própria) pra dentro de Configurações - o
 * Classroom precisa de escopos além dos pedidos no login, solicitados aqui
 * quando o usuário decide conectar, nunca na entrada.
 */
function IntegrationsContent() {
  const { data: status, isLoading } = useIntegrationStatus();
  const connect = useConnectClassroom();
  const sync = useSyncClassroom();
  const disconnect = useDisconnectClassroom();

  const connectCal = useConnectCalendar();
  const syncCal = useSyncCalendar();
  const disconnectCal = useDisconnectCalendar();

  const searchParams = useSearchParams();
  const router = useRouter();

  // O callback do OAuth volta para o dashboard; se o usuário veio de cá,
  // avisamos que a conexão deu certo.
  useEffect(() => {
    const conectado = searchParams.get('conectado');

    if (conectado === 'classroom' || conectado === 'calendar') {
      toast.success(
        conectado === 'classroom' ? 'Google Classroom conectado' : 'Google Calendar conectado',
        {
          description:
            conectado === 'classroom'
              ? 'Agora você pode sincronizar suas turmas.'
              : 'Agora você pode importar sua agenda.',
        },
      );
      router.replace('/configuracoes?tab=integracoes');
    }
  }, [searchParams, router]);

  if (isLoading || !status) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google Classroom */}
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <GraduationCap className="size-5" aria-hidden />
            </div>

            <div className="min-w-0">
              <CardTitle className="text-base">Google Classroom</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Importa turmas, professores, atividades, prazos e anexos.
              </p>
            </div>
          </div>

          {status.classroomConnected ? (
            <Badge variant="completed" className="shrink-0 gap-1">
              <CheckCircle2 className="size-3" aria-hidden />
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Não conectado
            </Badge>
          )}
        </CardHeader>

        <CardContent>
          {status.classroomConnected ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Disciplinas importadas</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {status.importedSubjects}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Atividades importadas</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {status.importedAssignments}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Última sincronização</p>
                  <p className="mt-1 text-sm font-medium">
                    {status.classroomSyncedAt ? formatRelative(status.classroomSyncedAt) : 'Nunca'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
                  <RefreshCw
                    className={sync.isPending ? 'size-4 animate-spin' : 'size-4'}
                    aria-hidden
                  />
                  {sync.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  <Link2Off className="size-4" aria-hidden />
                  Desconectar
                </Button>
              </div>

              {/* A política de merge precisa estar visível: o usuário tem de
                  saber o que a sincronização preserva do que ele editou. */}
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <ShieldCheck className="size-3.5" aria-hidden />O que a sincronização faz
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Atualiza</strong> título, descrição, prazo e
                    anexos vindos do Classroom.
                  </li>
                  <li>
                    <strong className="text-foreground">Preserva</strong> a prioridade, as
                    observações e a cor que você definiu.
                  </li>
                  <li>
                    <strong className="text-foreground">Nunca desmarca</strong> uma atividade que
                    você concluiu.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conecte para trazer suas turmas automaticamente. Pedimos acesso somente de leitura —
                o Painel não publica nem altera nada no Classroom.
              </p>

              <Button
                className="mt-4"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                <GoogleIcon className="size-4" />
                Conectar Google Classroom
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <CalendarDays className="size-5" aria-hidden />
            </div>

            <div className="min-w-0">
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Traz os compromissos da sua agenda para o calendário do Painel.
              </p>
            </div>
          </div>

          {status.calendarConnected ? (
            <Badge variant="completed" className="shrink-0 gap-1">
              <CheckCircle2 className="size-3" aria-hidden />
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Não conectado
            </Badge>
          )}
        </CardHeader>

        <CardContent>
          {status.calendarConnected ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Última sincronização</p>
                <p className="mt-1 text-sm font-medium">
                  {status.calendarSyncedAt ? formatRelative(status.calendarSyncedAt) : 'Nunca'}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => syncCal.mutate()} disabled={syncCal.isPending}>
                  <RefreshCw
                    className={syncCal.isPending ? 'size-4 animate-spin' : 'size-4'}
                    aria-hidden
                  />
                  {syncCal.isPending ? 'Importando...' : 'Importar agenda'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => disconnectCal.mutate()}
                  disabled={disconnectCal.isPending}
                >
                  <Link2Off className="size-4" aria-hidden />
                  Desconectar
                </Button>
              </div>

              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <ShieldCheck className="size-3.5" aria-hidden />O que a importação faz
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>
                    Importa do <strong className="text-foreground">calendário principal</strong>, de
                    30 dias atrás até 180 dias à frente.
                  </li>
                  <li>
                    Eventos recorrentes viram{' '}
                    <strong className="text-foreground">uma entrada por ocorrência</strong>.
                  </li>
                  <li>
                    Compromisso apagado no Google{' '}
                    <strong className="text-foreground">também some daqui</strong>.
                  </li>
                  <li>
                    Eventos criados no Painel{' '}
                    <strong className="text-foreground">nunca são alterados</strong>.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conecte para ver seus compromissos junto das provas e entregas. Pedimos acesso
                somente de leitura — o Painel não cria nem altera nada na sua agenda.
              </p>

              <Button
                className="mt-4"
                onClick={() => connectCal.mutate()}
                disabled={connectCal.isPending}
              >
                <GoogleIcon className="size-4" />
                Conectar Google Calendar
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {sync.isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium">A última sincronização falhou</p>
              <p className="mt-0.5 text-muted-foreground">
                {sync.error instanceof Error ? sync.error.message : 'Tente novamente.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** `useSearchParams` exige Suspense em páginas pré-renderizadas. */
export function IntegrationsPanel() {
  return (
    <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
      <IntegrationsContent />
    </Suspense>
  );
}
