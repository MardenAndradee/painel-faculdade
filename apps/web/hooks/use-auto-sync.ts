'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { integrationService } from '@/services/integration.service';
import { assignmentKeys } from './use-assignments';
import { subjectKeys } from './use-subjects';
import { dashboardKeys } from './use-dashboard';

/**
 * Sincroniza o Classroom quando o app abre.
 *
 * O servidor e quem decide se a sincronizacao acontece de fato: ele olha
 * `classroomSyncedAt` e ignora chamadas dentro da janela de 30 minutos. Este
 * hook so avisa "abri o app" - deixar a decisao aqui permitiria que uma aba
 * recarregando em laco esgotasse a cota do Google.
 *
 * Roda UMA vez por montagem, nao a cada navegacao entre telas: o layout do app
 * persiste enquanto o usuario circula, entao trocar de Disciplinas para
 * Atividades nao dispara nada.
 */
export function useAutoSync(): void {
  const queryClient = useQueryClient();

  // React 18+ monta duas vezes em desenvolvimento (StrictMode). Sem esta
  // trava a chamada sairia duplicada toda vez que o app abrisse localmente.
  const alreadyRan = useRef(false);

  useEffect(() => {
    if (alreadyRan.current) return;
    alreadyRan.current = true;

    let cancelled = false;

    void integrationService
      .autoSyncClassroom()
      .then(async (result) => {
        if (cancelled || !result.ran) return;

        const { subjects, assignments } = result.imported;

        // Nada novo? Fica calado. Um aviso de "sincronizado, 0 novidades" a
        // cada abertura vira ruido que o usuario aprende a ignorar - e ai o
        // aviso deixa de funcionar quando REALMENTE tem algo.
        if (subjects === 0 && assignments === 0) return;

        const partes = [
          assignments > 0 && `${assignments} ${assignments === 1 ? 'atividade' : 'atividades'}`,
          subjects > 0 && `${subjects} ${subjects === 1 ? 'disciplina' : 'disciplinas'}`,
        ].filter(Boolean);

        toast.success(`${partes.join(' e ')} do Classroom`, {
          description: 'Importadas automaticamente agora.',
        });

        // Só invalida quando algo entrou: refazer consultas à toa faria a tela
        // piscar a cada abertura sem motivo.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: assignmentKeys.all }),
          queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
          queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
        ]);
      })
      .catch(() => {
        // Silêncio proposital. Esta sincronização não foi pedida pelo usuário;
        // falhar nela não pode virar erro na cara de quem só abriu o app. O
        // botão em Integrações continua mostrando o relatório completo.
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
