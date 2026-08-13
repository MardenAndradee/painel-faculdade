'use client';

import { AlertCircle, CheckCircle2, FolderX, Users } from 'lucide-react';
import { useClassHealth } from '@/hooks/use-classes';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ClassHealthPanelProps {
  classId: string;
}

/**
 * Diagnóstico só de leitura para o dono (Etapa 24): onde a turma divergiu do
 * que deveria ser, sem exigir que ele vasculhe membro por membro.
 */
export function ClassHealthPanel({ classId }: ClassHealthPanelProps) {
  const { data: health, isLoading } = useClassHealth(classId);

  if (isLoading || !health) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const isHealthy =
    health.membersWithMissingLinks === 0 &&
    health.archivedLinkedSubjects === 0 &&
    health.postsWithIncompleteFanOut.length === 0;

  if (isHealthy) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <CheckCircle2 className="size-5 shrink-0 text-status-completed" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Tudo em dia: nenhum membro com pendência, nenhuma disciplina arquivada vinculada, e toda
          publicação chegou a todo mundo.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Membros com pendência</p>
            <Users className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {health.membersWithMissingLinks}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">sem alguma disciplina vinculada</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Vínculos arquivados</p>
            <FolderX className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {health.archivedLinkedSubjects}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            resolvem sozinhos na próxima publicação
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Publicações incompletas</p>
            <AlertCircle className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {health.postsWithIncompleteFanOut.length}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">cópias abaixo do nº de membros</p>
        </Card>
      </div>

      {health.postsWithIncompleteFanOut.length > 0 && (
        <div className="space-y-1.5">
          {health.postsWithIncompleteFanOut.map((post) => (
            <Card key={post.id} className="flex items-center justify-between gap-3 p-3">
              <p className="truncate text-sm">{post.title}</p>
              <p className="shrink-0 text-xs text-muted-foreground">{post.copyCount} cópia(s)</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
