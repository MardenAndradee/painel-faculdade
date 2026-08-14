'use client';

import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import type { ExamPrepActiveSession } from '@painel/shared';
import { useCompleteExamPrepSession, useQuickStartExamPrepSession } from '@/hooks/use-exam-preps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface StudySessionCardProps {
  examPrepId: string;
  activeSession: ExamPrepActiveSession | null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * "Começar sessão" / "Finalizar" (Etapa 9). O cronômetro é só de exibição -
 * `actualMinutes` sempre vem do servidor (`now - scheduledStart`), nunca do
 * `setInterval` do cliente. Reabrir a página com uma sessão já em andamento
 * (`plan.activeStudySession`) retoma o cronômetro a partir do horário real
 * de início, não do zero.
 */
export function StudySessionCard({ examPrepId, activeSession }: StudySessionCardProps) {
  const quickStart = useQuickStartExamPrepSession(examPrepId);
  const complete = useCompleteExamPrepSession(examPrepId);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!activeSession) return;

    const startedAt = new Date(activeSession.startedAt).getTime();
    const tick = (): void => setElapsedMs(Date.now() - startedAt);

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold">Sessão de estudo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registre o tempo que você estudou para esta prova.
          </p>
        </div>

        <Button type="button" onClick={() => quickStart.mutate()} disabled={quickStart.isPending}>
          <Play className="size-4" aria-hidden />
          Começar sessão
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-sm font-semibold">Sessão em andamento</h2>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{formatElapsed(elapsedMs)}</p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => complete.mutate({ id: activeSession.id, data: {} })}
        disabled={complete.isPending}
      >
        <Square className="size-4" aria-hidden />
        Finalizar
      </Button>
    </Card>
  );
}
