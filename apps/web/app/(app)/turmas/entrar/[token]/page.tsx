'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react';
import { useClassInvitePreview, useJoinClass } from '@/hooks/use-classes';
import { ApiError } from '@/services/http-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { subjectInitials } from '@/lib/format';

/**
 * Tela de entrada por convite (Etapa 20).
 *
 * Mostra o que a turma é ANTES de confirmar - nome, dono, quantos membros e
 * disciplinas - para que entrar não seja um salto no escuro.
 */
export default function JoinClassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const { data: preview, isLoading, isError, error } = useClassInvitePreview(token);
  const joinClass = useJoinClass();

  const handleJoin = async (): Promise<void> => {
    try {
      const result = await joinClass.mutateAsync(token);
      router.push(`/turmas/${result.class.id}`);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-10">
      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="mx-auto h-12 w-12 rounded-lg" />
          <Skeleton className="mx-auto mt-4 h-5 w-2/3" />
          <Skeleton className="mx-auto mt-2 h-4 w-1/2" />
        </Card>
      ) : isError || !preview ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Convite inválido"
            description={
              error instanceof ApiError ? error.message : 'Este link de convite não existe mais.'
            }
            action={
              <Button size="sm" asChild>
                <Link href="/turmas">Ir para Turmas</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <span
            className="mx-auto flex size-12 items-center justify-center rounded-xl text-base font-semibold"
            style={{ backgroundColor: `${preview.class.color}1f`, color: preview.class.color }}
            aria-hidden
          >
            {subjectInitials(preview.class.name)}
          </span>

          <h1 className="mt-4 text-lg font-semibold tracking-tight">{preview.class.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.class.year}.{String(preview.class.term).padStart(2, '0')} · de{' '}
            {preview.owner.name}
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {preview.memberCount} {preview.memberCount === 1 ? 'membro' : 'membros'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5" aria-hidden />
              {preview.subjectCount} {preview.subjectCount === 1 ? 'disciplina' : 'disciplinas'}
            </span>
          </div>

          {preview.alreadyMember ? (
            <>
              <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-status-completed">
                <CheckCircle2 className="size-4" aria-hidden />
                Você já é membro desta turma
              </p>
              <Button className="mt-3 w-full" asChild>
                <Link href={`/turmas/${preview.class.id}`}>Ir para a turma</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mt-5 text-xs text-muted-foreground">
                Ao entrar, seu semestre e disciplinas correspondentes são montados automaticamente.
              </p>
              <Button
                variant="accent"
                className="mt-3 w-full"
                onClick={() => void handleJoin()}
                disabled={joinClass.isPending}
              >
                {joinClass.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Entrar na turma
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
