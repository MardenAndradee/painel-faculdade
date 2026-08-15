'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, KeyRound, Link2Off, MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { useLoginMethods, useStartGoogleLink, useUnlinkGoogle } from '@/hooks/use-login-methods';
import { PasswordDialog } from '@/components/auth/password-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GoogleIcon } from '@/components/google-icon';

const LINK_ERROR_MESSAGES: Record<string, string> = {
  conflict: 'Não foi possível vincular esta conta Google.',
  unauthorized: 'Sua sessão expirou. Entre novamente e tente de novo.',
  falha_login: 'Não foi possível concluir o vínculo. Tente novamente.',
};

/**
 * Configurações → Conta (Etapa 26).
 *
 * Mostra os dois métodos de login possíveis - e-mail/senha e Google - e as
 * ações de cada um. A garantia de nunca deixar a conta sem nenhum método é
 * do BACKEND (`authService.unlinkGoogle`), não desta tela: o botão de
 * desvincular fica desabilitado como conveniência, mas a rota recusaria de
 * qualquer forma.
 */
function AccountSettingsContent() {
  const { data: methods, isLoading } = useLoginMethods();
  const startLink = useStartGoogleLink();
  const unlinkGoogle = useUnlinkGoogle();

  const [passwordDialog, setPasswordDialog] = useState<'add' | 'change' | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Retorno do vínculo do Google (sucesso ou falha) - ver auth.controller.ts.
  useEffect(() => {
    const vinculado = searchParams.get('vinculado');
    const erroVinculo = searchParams.get('erroVinculo');

    if (vinculado === 'google') {
      toast.success('Google vinculado');
      router.replace('/configuracoes?tab=conta');
    } else if (erroVinculo) {
      toast.error(LINK_ERROR_MESSAGES[erroVinculo] ?? LINK_ERROR_MESSAGES.falha_login);
      router.replace('/configuracoes?tab=conta');
    }
  }, [searchParams, router]);

  if (isLoading || !methods) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const isGoogleLinked = methods.linkedProviders.includes('GOOGLE');
  // A última trava fica no backend; aqui só evita um clique que sabemos que vai falhar.
  const canUnlinkGoogle = isGoogleLinked && methods.hasPassword;

  return (
    <>
      <div className="space-y-4">
        {methods.hasPassword && !methods.emailVerified && (
          <div className="flex items-start gap-2 rounded-lg border border-status-pending/30 bg-status-pending/10 p-3 text-sm">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-status-pending" aria-hidden />
            <span>
              Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada para concluir a
              confirmação.
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <KeyRound className="size-5" aria-hidden />
              </div>

              <div className="min-w-0">
                <CardTitle className="text-base">E-mail e senha</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Entre com seu e-mail e senha, sem depender do Google.
                </p>
              </div>
            </div>

            {methods.hasPassword ? (
              <Badge variant="completed" className="shrink-0 gap-1">
                <CheckCircle2 className="size-3" aria-hidden />
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Não configurado
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            <Button
              variant={methods.hasPassword ? 'outline' : 'default'}
              onClick={() => setPasswordDialog(methods.hasPassword ? 'change' : 'add')}
            >
              {methods.hasPassword ? 'Trocar senha' : 'Adicionar senha'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <GoogleIcon className="size-5" />
              </div>

              <div className="min-w-0">
                <CardTitle className="text-base">Google</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Entre com um clique usando sua conta Google.
                </p>
              </div>
            </div>

            {isGoogleLinked ? (
              <Badge variant="completed" className="shrink-0 gap-1">
                <CheckCircle2 className="size-3" aria-hidden />
                Vinculado
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Não vinculado
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            {isGoogleLinked ? (
              <Button
                variant="outline"
                onClick={() => unlinkGoogle.mutate()}
                disabled={!canUnlinkGoogle || unlinkGoogle.isPending}
                title={
                  canUnlinkGoogle
                    ? undefined
                    : 'Defina uma senha antes de desvincular - sua conta ficaria sem nenhum jeito de entrar'
                }
              >
                <Link2Off className="size-4" aria-hidden />
                Desvincular
              </Button>
            ) : (
              <Button onClick={() => startLink.mutate()} disabled={startLink.isPending}>
                <GoogleIcon className="size-4" />
                Vincular Google
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <PasswordDialog
        open={passwordDialog !== null}
        onOpenChange={(open) => !open && setPasswordDialog(null)}
        mode={passwordDialog ?? 'add'}
      />
    </>
  );
}

/** `useSearchParams` exige Suspense em páginas pré-renderizadas. */
export function AccountSettingsPanel() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <AccountSettingsContent />
    </Suspense>
  );
}
