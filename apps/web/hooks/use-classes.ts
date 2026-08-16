'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  defaultSemesterName,
  type ClassSubjectInput,
  type CreateClassInput,
  type CreateClassInviteInput,
  type TransferClassOwnerInput,
  type UpdateClassInput,
} from '@painel/shared';
import { classService } from '@/services/class.service';
import { subjectKeys } from './use-subjects';
import { semesterKeys } from './use-semesters';
import { dashboardKeys } from './use-dashboard';
import { errorMessage } from '@/lib/api-error';

/**
 * Hooks de turmas (Etapa 20).
 *
 * Entrar/sair de uma turma mexe em `Subject` e `Semester` do usuário (o
 * *fan-out* de cópia) - por isso essas mutações invalidam também as listas
 * de disciplinas, semestres e o dashboard, não só as próprias chaves de turma.
 */

export const classKeys = {
  all: ['classes'] as const,
  list: () => ['classes', 'list'] as const,
  detail: (id: string) => ['classes', 'detail', id] as const,
  members: (id: string) => ['classes', 'members', id] as const,
  invites: (id: string) => ['classes', 'invites', id] as const,
  invitePreview: (token: string) => ['classes', 'invite-preview', token] as const,
  health: (id: string) => ['classes', 'health', id] as const,
  finishSemesterPreview: (id: string) => ['classes', 'finish-semester-preview', id] as const,
  history: (id: string) => ['classes', 'history', id] as const,
};

export function useClasses() {
  return useQuery({
    queryKey: classKeys.list(),
    queryFn: () => classService.list(),
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: classKeys.detail(id),
    queryFn: () => classService.getById(id),
    enabled: Boolean(id),
  });
}

export function useClassMembers(id: string) {
  return useQuery({
    queryKey: classKeys.members(id),
    queryFn: () => classService.listMembers(id),
    enabled: Boolean(id),
  });
}

export function useClassInvites(id: string, enabled = true) {
  return useQuery({
    queryKey: classKeys.invites(id),
    queryFn: () => classService.listInvites(id),
    enabled: enabled && Boolean(id),
  });
}

export function useClassInvitePreview(token: string) {
  return useQuery({
    queryKey: classKeys.invitePreview(token),
    queryFn: () => classService.previewInvite(token),
    enabled: Boolean(token),
    retry: false,
  });
}

/** Painel de saúde da turma (Etapa 24) - só o dono chama, mas a rota mesmo garante isso. */
export function useClassHealth(id: string) {
  return useQuery({
    queryKey: classKeys.health(id),
    queryFn: () => classService.health(id),
    enabled: Boolean(id),
  });
}

/** Prévia do "Finalizar semestre" (Etapa 30.5) - carrega só quando o diálogo abre. */
export function useFinishSemesterPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: classKeys.finishSemesterPreview(id),
    queryFn: () => classService.finishSemesterPreview(id),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}

/** Ciclos anteriores da turma (Etapa 30.8) - qualquer membro ativo pode ler. */
export function useClassHistory(id: string) {
  return useQuery({
    queryKey: classKeys.history(id),
    queryFn: () => classService.getHistory(id),
    enabled: Boolean(id),
  });
}

function useInvalidateClasses() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: classKeys.all });
  };
}

/** Entrar/sair mexe no que o *fan-out* copiou: disciplinas, semestres e dashboard. */
function useInvalidateFanOut() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: classKeys.all }),
      queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
      queryClient.invalidateQueries({ queryKey: semesterKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
  };
}

export function useCreateClass() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: (data: CreateClassInput) => classService.create(data),
    onSuccess: async (created) => {
      await invalidate();
      toast.success(`Turma "${created.name}" criada`);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível criar a turma'));
    },
  });
}

export function useUpdateClass() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClassInput }) =>
      classService.update(id, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Turma atualizada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível salvar as alterações'));
    },
  });
}

/**
 * Avança a turma pro próximo semestre/período (Etapa 30.5).
 *
 * Mexe no `semesterId` pessoal de cada membro ativo (mesmo *fan-out* de
 * `useJoinClass`) - por isso usa `useInvalidateFanOut`, não só as chaves de
 * turma. Invalida também o Histórico: o ciclo que acabou de terminar passa a
 * aparecer lá.
 */
export function useFinishSemester() {
  const invalidateFanOut = useInvalidateFanOut();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => classService.finishSemester(id),
    onSuccess: async (updated) => {
      await Promise.all([
        invalidateFanOut(),
        queryClient.invalidateQueries({ queryKey: classKeys.history(updated.id) }),
      ]);
      toast.success(`Turma avançada para ${defaultSemesterName(updated)}`, {
        description: `Agora no ${updated.period}º período. O ciclo anterior foi para o Histórico.`,
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível finalizar o semestre'));
    },
  });
}

export function useLeaveClass() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: (id: string) => classService.leave(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Você saiu da turma', {
        description: 'Suas disciplinas e notas foram preservadas.',
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível sair da turma'));
    },
  });
}

export function useAddClassSubject() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ classId, data }: { classId: string; data: ClassSubjectInput }) =>
      classService.addSubject(classId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina adicionada à turma');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível adicionar a disciplina'));
    },
  });
}

export function useUpdateClassSubject() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({
      classId,
      subjectId,
      data,
    }: {
      classId: string;
      subjectId: string;
      data: Partial<ClassSubjectInput>;
    }) => classService.updateSubject(classId, subjectId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina atualizada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível salvar as alterações'));
    },
  });
}

export function useRemoveClassSubject() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ classId, subjectId }: { classId: string; subjectId: string }) =>
      classService.removeSubject(classId, subjectId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Disciplina removida da turma');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível remover a disciplina'));
    },
  });
}

export function useCreateClassInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, data }: { classId: string; data: CreateClassInviteInput }) =>
      classService.createInvite(classId, data),
    onSuccess: async (_result, { classId }) => {
      await queryClient.invalidateQueries({ queryKey: classKeys.invites(classId) });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível criar o convite'));
    },
  });
}

export function useRevokeClassInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, inviteId }: { classId: string; inviteId: string }) =>
      classService.revokeInvite(classId, inviteId),
    onSuccess: async (_result, { classId }) => {
      await queryClient.invalidateQueries({ queryKey: classKeys.invites(classId) });
      toast.success('Convite revogado');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível revogar o convite'));
    },
  });
}

export function useJoinClass() {
  const invalidate = useInvalidateFanOut();

  return useMutation({
    mutationFn: (token: string) => classService.join(token),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`Você entrou em "${result.class.name}"`, {
        description:
          result.subjectsCreated > 0
            ? `${result.subjectsCreated} disciplina(s) nova(s), ${result.subjectsLinked} vinculada(s).`
            : `${result.subjectsLinked} disciplina(s) vinculada(s).`,
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível entrar na turma'));
    },
  });
}

export function useTransferClassOwner() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ classId, data }: { classId: string; data: TransferClassOwnerInput }) =>
      classService.transferOwner(classId, data),
    onSuccess: async () => {
      await invalidate();
      toast.success('Propriedade transferida');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível transferir a propriedade'));
    },
  });
}

export function useArchiveClass() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: (classId: string) => classService.archive(classId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Turma arquivada', {
        description: 'Convites, entrada e novas publicações ficam bloqueados até desarquivar.',
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível arquivar a turma'));
    },
  });
}

export function useUnarchiveClass() {
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: (classId: string) => classService.unarchive(classId),
    onSuccess: async () => {
      await invalidate();
      toast.success('Turma desarquivada');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Não foi possível desarquivar a turma'));
    },
  });
}
