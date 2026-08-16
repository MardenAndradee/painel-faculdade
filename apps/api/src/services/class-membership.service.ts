import type { JoinClassResult } from '@painel/shared';
import { classRepository } from '../repositories/class.repository.js';
import { classService } from './class.service.js';
import { classPostService } from './class-post.service.js';
import { ensureMemberSubjectLink, resolveMemberSemester } from './class-subject-linking.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * Entrada numa turma (Etapa 20): o *fan-out* de leitura que monta o semestre
 * e as disciplinas do membro a partir do convite.
 *
 * Fluxo isolado do resto de `class.service` porque e o unico ponto que
 * escreve em `Semester`/`Subject` (dominio de outro modulo) a partir de uma
 * acao de turma - misturar as duas responsabilidades no mesmo arquivo
 * deixaria dificil saber quem e dono de qual efeito colateral.
 */

export const classMembershipService = {
  /**
   * Aceita um convite: garante a associação, monta o semestre correspondente
   * e vincula/cria cada disciplina do molde na disciplina do membro.
   *
   * Sequencial e nao-atomico de proposito, no mesmo espirito de
   * `classroomSyncService.sync` - uma disciplina que falhe no meio nao deve
   * reverter as que ja foram montadas com sucesso.
   */
  async join(userId: string, token: string): Promise<JoinClassResult> {
    const invite = await classService.resolveValidInvite(token);
    const classId = invite.classId;

    const existingMembership = await classRepository.findMemberRow(classId, userId);

    if (existingMembership?.status === 'ACTIVE') {
      throw AppError.conflict('Você já é membro desta turma');
    }

    if (!existingMembership) {
      const memberCount = await classRepository.countActiveMembers(classId);

      if (memberCount >= classService.maxMembersPerClass) {
        throw AppError.conflict(
          `Esta turma já atingiu o limite de ${classService.maxMembersPerClass} membros`,
        );
      }

      // Limite de uma turma ativa por vez (Etapa 30.1) - só checa em entrada
      // nova; reativar uma turma que já era sua (LEFT -> ACTIVE de novo) não
      // conta como "entrar em outra".
      const activeMembership = await classRepository.findActiveMembership(userId);

      if (activeMembership) {
        throw AppError.conflict(
          'Você já participa de uma turma ativa — saia ou arquive antes de entrar em outra',
        );
      }
    }

    const semester = await resolveMemberSemester(
      userId,
      invite.class.semester.year,
      invite.class.semester.term,
    );

    const member = existingMembership
      ? await classRepository.reactivateMember(existingMembership.id, semester.id)
      : await classRepository.createMember(classId, userId, semester.id);

    const classSubjects = await classRepository.listSubjectsFull(classId);

    let subjectsLinked = 0;
    let subjectsCreated = 0;

    for (const classSubject of classSubjects) {
      const result = await ensureMemberSubjectLink(userId, semester.id, member.id, classSubject);

      if (result.created) subjectsCreated += 1;
      else subjectsLinked += 1;
    }

    // Fan-out retroativo (Etapa 21): publicações já vigentes da turma viram
    // cópia pessoal também para quem entra depois, não só para quem já
    // estava lá quando foram publicadas.
    await classPostService.fanOutToNewMember(classId, member.id, userId, semester.id);

    await classRepository.incrementInviteUse(invite.id);

    const classDetail = await classService.getById(userId, classId);

    return { class: classDetail, semester, subjectsLinked, subjectsCreated };
  },
};
