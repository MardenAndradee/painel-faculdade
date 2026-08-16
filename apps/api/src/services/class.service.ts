import {
  nextSemesterKey,
  type ClassDetail,
  type ClassFinishSemesterPreview,
  type ClassHealthSummary,
  type ClassHistory,
  type ClassHistoryCycle,
  type ClassInviteCreated,
  type ClassInviteItem,
  type ClassInvitePreview,
  type ClassMemberItem,
  type ClassPostSummary,
  type ClassRole,
  type ClassSubjectInput,
  type ClassSubjectItem,
  type ClassSummary,
  type CreateClassInput,
  type CreateClassInviteInput,
  type UpdateClassInput,
} from '@painel/shared';
import { env } from '../config/env.js';
import {
  classRepository,
  type ClassDetailRow,
  type ClassInviteRow,
  type ClassListRow,
  type ClassMemberRow,
  type ClassSubjectRow,
  type NewClassSubject,
} from '../repositories/class.repository.js';
import { classPostRepository, type ClassPostRow } from '../repositories/class-post.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { ensureMemberSubjectLink } from './class-subject-linking.service.js';
import { semesterService } from './semester.service.js';
import { AppError } from '../utils/app-error.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { emptyToNull } from '../utils/text.js';

/**
 * Regra de negocio de turmas (Etapa 20).
 *
 * CRUD da turma, disciplinas-molde, membros e convites. A entrada
 * propriamente dita (o *fan-out* de semestre/disciplinas ao aceitar um
 * convite) mora em `class-membership.service` - e um fluxo grande o
 * suficiente para merecer arquivo proprio.
 */

/** Teto de infraestrutura: ver "Restricao de infraestrutura" no README. */
const MAX_MEMBERS_PER_CLASS = 100;

function toSubjectInput(input: ClassSubjectInput): NewClassSubject {
  return {
    name: input.name,
    code: emptyToNull(input.code),
    color: input.color,
    teacherName: emptyToNull(input.teacherName),
    credits: input.credits ?? null,
  };
}

function toSummary(role: ClassRole, row: ClassListRow): ClassSummary {
  return {
    id: row.id,
    name: row.name,
    year: row.semester.year,
    term: row.semester.term,
    period: row.period,
    color: row.color,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    myRole: role,
    memberCount: row._count.members,
    subjectCount: row._count.subjects,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSubjectItem(row: ClassSubjectRow): ClassSubjectItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    teacherName: row.teacherName,
    credits: row.credits,
    order: row.order,
    linkedMemberCount: row._count.links,
  };
}

function toDetail(role: ClassRole, row: ClassDetailRow, myLinkedSubjectIds: string[]): ClassDetail {
  return {
    id: row.id,
    name: row.name,
    year: row.semester.year,
    term: row.semester.term,
    period: row.period,
    semesterId: row.semesterId,
    description: row.description,
    color: row.color,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    myRole: role,
    memberCount: row._count.members,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // So o ciclo atual (Etapa 30.8) - o que ja foi "Finalizado" mora na aba
    // Historico, nunca na visao principal da turma.
    subjects: row.subjects
      .filter((subject) => subject.semesterId === row.semesterId)
      .map(toSubjectItem),
    myLinkedSubjectIds,
  };
}

function toMemberItem(row: ClassMemberRow): ClassMemberItem {
  return {
    id: row.id,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
    user: row.user,
  };
}

function toPostSummary(row: ClassPostRow): ClassPostSummary {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    classSubject: row.classSubject,
    copyCount: row._count.copies,
  };
}

function toInviteItem(row: ClassInviteRow): ClassInviteItem {
  return {
    id: row.id,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    maxUses: row.maxUses,
    useCount: row.useCount,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Garante e devolve o papel do usuario. 404 (nunca 403) para nao-membro - ver README. */
async function requireMembership(userId: string, classId: string): Promise<ClassRole> {
  const membership = await classRepository.findMembership(userId, classId);

  if (!membership || membership.status !== 'ACTIVE') throw AppError.notFound('Turma');

  return membership.role;
}

function requireOwner(role: ClassRole): void {
  if (role !== 'OWNER') throw AppError.forbidden('Apenas o dono da turma pode fazer isso');
}

/**
 * Trava de escrita (Etapa 24): turma arquivada não recebe atividade nova -
 * convite, entrada, publicação (post, aviso, material). Ler, sair e
 * desarquivar continuam liberados.
 */
async function assertNotArchived(classId: string): Promise<void> {
  const archivedAt = await classRepository.findArchivedAt(classId);

  if (archivedAt) throw AppError.conflict('Esta turma está arquivada');
}

/**
 * Vincula direto por id em vez de casar por nome: o dono escolheu uma das
 * PRÓPRIAS disciplinas já existentes na hora de montar o molde, então não há
 * erro de digitação possível - só confere que a disciplina é mesmo dele e que
 * ela ainda não está vinculada a NENHUMA outra disciplina-molde desta mesma
 * turma antes de criar o vínculo - sem essa segunda checagem, escolher a
 * mesma disciplina pessoal duas vezes criaria dois moldes apontando pra ela.
 */
async function linkExistingSubject(
  ownerId: string,
  classId: string,
  classSubjectId: string,
  ownerMemberId: string,
  existingSubjectId: string,
): Promise<void> {
  const subject = await subjectRepository.findById(ownerId, existingSubjectId);

  if (!subject) throw AppError.badRequest('Disciplina inválida');

  const alreadyLinked = await classRepository.listMyLinkedSubjectIds(classId, ownerId);

  if (alreadyLinked.includes(existingSubjectId)) {
    throw AppError.conflict('Esta disciplina já está vinculada a esta turma');
  }

  await classRepository.createLink(classSubjectId, ownerId, existingSubjectId, ownerMemberId);
}

export const classService = {
  async list(userId: string): Promise<ClassSummary[]> {
    const rows = await classRepository.findMyMemberships(userId);

    return rows.map((row) => toSummary(row.role, row.class));
  },

  /** Usado pelo `classGuard` - lanca 404 quando nao ha vinculo ativo. */
  assertMembership: requireMembership,

  async getById(userId: string, classId: string): Promise<ClassDetail> {
    const role = await requireMembership(userId, classId);
    const row = await classRepository.findDetail(classId);

    if (!row) throw AppError.notFound('Turma');

    const myLinkedSubjectIds = await classRepository.listMyLinkedSubjectIds(classId, userId);

    return toDetail(role, row, myLinkedSubjectIds);
  },

  /**
   * Cria a turma e o dono como primeiro membro.
   *
   * O dono também é um `ClassMember` (role OWNER) - por isso passa pelo MESMO
   * `ensureMemberSubjectLink` que um membro comum usa ao entrar. Sem isso, o
   * dono ficaria sem disciplinas pessoais vinculadas e nunca receberia cópia
   * das próprias publicações (Etapa 21).
   *
   * O `Semester` canônico da turma (Etapa 30) é resolvido ANTES de criar a
   * `Class` - `semesterId` é `NOT NULL`, então precisa existir primeiro. É o
   * mesmo id usado pro `ClassMember` do dono, dispensando a chamada separada
   * que existia antes desta etapa.
   */
  async create(ownerId: string, input: CreateClassInput): Promise<ClassDetail> {
    const activeMembership = await classRepository.findActiveMembership(ownerId);

    if (activeMembership) {
      throw AppError.conflict(
        'Você já participa de uma turma ativa — saia ou arquive antes de criar outra',
      );
    }

    const semester = await semesterService.ensure(ownerId, { year: input.year, term: input.term });

    const row = await classRepository.create(
      ownerId,
      {
        name: input.name,
        semesterId: semester.id,
        period: input.period,
        description: emptyToNull(input.description),
        color: input.color,
      },
      input.subjects.map(toSubjectInput),
    );

    const ownerMember = await classRepository.findMemberRow(row.id, ownerId);

    await classRepository.setMemberSemester(ownerMember!.id, semester.id);

    for (const [index, subject] of row.subjects.entries()) {
      const existingSubjectId = input.subjects[index]?.existingSubjectId;

      if (existingSubjectId) {
        await linkExistingSubject(ownerId, row.id, subject.id, ownerMember!.id, existingSubjectId);
      } else {
        await ensureMemberSubjectLink(ownerId, semester.id, ownerMember!.id, subject);
      }
    }

    const myLinkedSubjectIds = await classRepository.listMyLinkedSubjectIds(row.id, ownerId);

    return toDetail('OWNER', row, myLinkedSubjectIds);
  },

  /**
   * Edita nome/cor/descrição/período. `semesterId` fica de fora de propósito
   * (Etapa 30, Decisão da 30.7) - a única forma sancionada de mudar o
   * semestre/ciclo da turma é "Finalizar semestre" (`finishSemester`), pra
   * nunca desalinhar `period` de `semesterId` por uma edição solta.
   */
  async update(userId: string, classId: string, input: UpdateClassInput): Promise<ClassDetail> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const row = await classRepository.update(classId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.period !== undefined ? { period: input.period } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    });

    const myLinkedSubjectIds = await classRepository.listMyLinkedSubjectIds(classId, userId);

    return toDetail(role, row, myLinkedSubjectIds);
  },

  // --- Finalizar semestre (Etapa 30.5) --------------------------------------------

  /** Prévia: o próximo semestre/período e quanto ficará no Histórico, sem gravar nada. */
  async finishSemesterPreview(
    userId: string,
    classId: string,
  ): Promise<ClassFinishSemesterPreview> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const row = await classRepository.findDetail(classId);

    if (!row) throw AppError.notFound('Turma');

    const next = nextSemesterKey({ year: row.semester.year, term: row.semester.term });
    const [subjectCount, postCount] = await Promise.all([
      classRepository.countSubjects(classId),
      classPostRepository.countByClass(classId),
    ]);

    return {
      currentSemester: { year: row.semester.year, term: row.semester.term },
      nextSemester: { ...next, name: `${next.year}.${next.term}` },
      currentPeriod: row.period,
      nextPeriod: row.period + 1,
      subjectCount,
      postCount,
    };
  },

  /**
   * Avança a turma pro próximo semestre/período.
   *
   * Não cria `ClassSubject`/`ClassPost` novos (o ciclo novo começa vazio,
   * decisão explícita) e não toca em `semesterService.close` de ninguém - as
   * notas pessoais continuam sendo uma decisão de cada membro, no ritmo dele,
   * em Histórico. O que já existe (moldes, publicações) permanece marcado com
   * o `semesterId` antigo - é assim que a aba Histórico da turma separa
   * "atual" de "ciclos anteriores" (Etapa 30.8).
   */
  async finishSemester(userId: string, classId: string): Promise<ClassDetail> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const row = await classRepository.findDetail(classId);

    if (!row) throw AppError.notFound('Turma');

    const next = nextSemesterKey({ year: row.semester.year, term: row.semester.term });

    const ownerNextSemester = await semesterService.ensure(userId, next);

    const members = await classRepository.listActiveMembersWithSemester(classId);

    for (const member of members) {
      const memberNextSemester = await semesterService.ensure(member.userId, next);

      await classRepository.setMemberSemester(member.id, memberNextSemester.id);
    }

    const updated = await classRepository.update(classId, {
      semester: { connect: { id: ownerNextSemester.id } },
      period: row.period + 1,
    });

    const myLinkedSubjectIds = await classRepository.listMyLinkedSubjectIds(classId, userId);

    return toDetail(role, updated, myLinkedSubjectIds);
  },

  async listMembers(userId: string, classId: string): Promise<ClassMemberItem[]> {
    await requireMembership(userId, classId);

    const rows = await classRepository.listMembers(classId);

    return rows.map(toMemberItem);
  },

  /**
   * O dono nao pode sair pela porta lateral: precisa transferir a
   * propriedade antes (`transferOwner`), ou arquivar a turma se não houver
   * para quem transferir. Sem essa trava, a turma ficaria orfa.
   */
  async leave(userId: string, classId: string): Promise<void> {
    const role = await requireMembership(userId, classId);

    if (role === 'OWNER') {
      throw AppError.conflict(
        'O dono não pode sair da turma. Transfira a propriedade para outro membro, ou arquive a turma.',
      );
    }

    const left = await classRepository.leave(classId, userId);

    if (!left) throw AppError.notFound('Turma');
  },

  /**
   * Passa a propriedade para outro membro ativo: o dono atual vira MEMBER, o
   * escolhido vira OWNER. O próprio dono não pode se escolher - não é uma
   * transferência, é um `update` vazio disfarçado, e confundiria quem lê o
   * histórico de "quem já foi dono".
   */
  async transferOwner(userId: string, classId: string, newOwnerUserId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    if (newOwnerUserId === userId) {
      throw AppError.badRequest('Você já é o dono desta turma');
    }

    const currentOwnerMember = await classRepository.findMemberRow(classId, userId);
    const newOwnerMember = await classRepository.findMemberRow(classId, newOwnerUserId);

    if (!newOwnerMember || newOwnerMember.status !== 'ACTIVE') {
      throw AppError.badRequest('Só um membro ativo da turma pode virar o novo dono');
    }

    await classRepository.transferOwner(
      classId,
      currentOwnerMember!.id,
      newOwnerMember.id,
      newOwnerUserId,
    );
  },

  // --- Arquivamento --------------------------------------------------------------

  /**
   * Arquiva a turma: para de aceitar convite, entrada e publicação nova,
   * mas preserva tudo - o mesmo espírito de "excluir disciplina arquiva por
   * padrão" (ver README). É também a resposta para o dono sozinho numa
   * turma: sem outro membro para transferir, arquivar é a única saída.
   */
  async archive(userId: string, classId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    await classRepository.setArchived(classId, new Date());
  },

  async unarchive(userId: string, classId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    await classRepository.setArchived(classId, null);
  },

  /** Usado pelas publicações (post, aviso, material) - turma arquivada não recebe atividade nova. */
  assertNotArchived,

  // --- Painel de saúde -------------------------------------------------------------

  /**
   * Diagnóstico só de leitura para o dono: onde a turma divergiu do que
   * deveria ser, sem exigir que ele vasculhe membro por membro.
   */
  async health(userId: string, classId: string): Promise<ClassHealthSummary> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const [members, subjects, linkPairs, archivedLinkedSubjects, posts] = await Promise.all([
      classRepository.listActiveMembersWithSemester(classId),
      classRepository.listSubjectsFull(classId),
      classRepository.listActiveLinkPairs(classId),
      classRepository.countArchivedLinkedSubjects(classId),
      classPostRepository.listByClass(classId),
    ]);

    const linkedKeys = new Set(linkPairs.map((pair) => `${pair.classSubjectId}:${pair.userId}`));

    const membersWithMissingLinks = members.filter((member) =>
      subjects.some((subject) => !linkedKeys.has(`${subject.id}:${member.userId}`)),
    ).length;

    const postsWithIncompleteFanOut = posts
      .filter((post) => post._count.copies < members.length)
      .map((post) => ({ id: post.id, title: post.title, copyCount: post._count.copies }));

    return { membersWithMissingLinks, archivedLinkedSubjects, postsWithIncompleteFanOut };
  },

  // --- Histórico da turma (Etapa 30.8) ----------------------------------------------

  /**
   * Ciclos anteriores da turma - qualquer membro ativo pode ler, não só o
   * dono (é histórico coletivo, não gestão). Agrupado por `semesterId`, que
   * junto com `period` (ambos imutáveis em `ClassSubject`/`ClassPost`) é o
   * que sobrevive a "Finalizar semestre" tirando o ciclo da aba principal.
   */
  async getHistory(userId: string, classId: string): Promise<ClassHistory> {
    await requireMembership(userId, classId);

    const row = await classRepository.findDetail(classId);

    if (!row) throw AppError.notFound('Turma');

    const [subjects, posts] = await Promise.all([
      classRepository.listSubjectsOutsideSemester(classId, row.semesterId),
      classPostRepository.listOutsideSemester(classId, row.semesterId),
    ]);

    const cycles = new Map<string, ClassHistoryCycle>();

    function cycleFor(semesterId: string, semesterName: string, period: number): ClassHistoryCycle {
      const existing = cycles.get(semesterId);

      if (existing) return existing;

      const created: ClassHistoryCycle = {
        semesterId,
        semesterName,
        period,
        subjects: [],
        posts: [],
      };

      cycles.set(semesterId, created);

      return created;
    }

    for (const subject of subjects) {
      cycleFor(subject.semesterId, subject.semester.name, subject.period).subjects.push(
        toSubjectItem(subject),
      );
    }

    for (const post of posts) {
      cycleFor(post.semesterId, post.semester.name, post.period).posts.push(toPostSummary(post));
    }

    return { cycles: [...cycles.values()].sort((a, b) => b.period - a.period) };
  },

  // --- Disciplinas-molde -------------------------------------------------------

  /**
   * Adiciona uma disciplina ao molde.
   *
   * Faz o *backfill* retroativo: membros que já estavam na turma ganham a
   * disciplina agora, no mesmo casamento por nome usado ao entrar - sem
   * isso, só quem entrasse DEPOIS deste ponto teria a disciplina montada
   * automaticamente, e a turma divergiria silenciosamente do que os membros
   * antigos têm.
   */
  async addSubject(
    userId: string,
    classId: string,
    input: ClassSubjectInput,
  ): Promise<ClassSubjectItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const cycle = await classRepository.findCycle(classId);

    if (!cycle) throw AppError.notFound('Turma');

    const order = await classRepository.countSubjects(classId);
    const row = await classRepository.addSubject(classId, cycle, toSubjectInput(input), order);

    if (input.existingSubjectId) {
      const ownerMember = await classRepository.findMemberRow(classId, userId);

      await linkExistingSubject(userId, classId, row.id, ownerMember!.id, input.existingSubjectId);
    }

    const members = await classRepository.listActiveMembersWithSemester(classId);

    for (const member of members) {
      await ensureMemberSubjectLink(member.userId, member.semesterId, member.id, row);
    }

    return toSubjectItem(row);
  },

  /**
   * Editar o molde. Renomear PROPAGA o novo nome para toda `Subject` ja
   * vinculada - decisao registrada no README: o membro nao tem como divergir
   * o nome da disciplina da turma, quem manda nisso e o dono.
   */
  async updateSubject(
    userId: string,
    classId: string,
    classSubjectId: string,
    input: Partial<ClassSubjectInput>,
  ): Promise<ClassSubjectItem> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const current = await classRepository.findSubject(classId, classSubjectId);

    if (!current) throw AppError.notFound('Disciplina da turma');

    const row = await classRepository.updateSubject(classId, classSubjectId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: emptyToNull(input.code) } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.teacherName !== undefined ? { teacherName: emptyToNull(input.teacherName) } : {}),
      ...(input.credits !== undefined ? { credits: input.credits ?? null } : {}),
    });

    if (!row) throw AppError.notFound('Disciplina da turma');

    if (input.name !== undefined && input.name !== current.name) {
      await classRepository.propagateSubjectName(classSubjectId, input.name);
    }

    return toSubjectItem(row);
  },

  async removeSubject(userId: string, classId: string, classSubjectId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const removed = await classRepository.removeSubject(classId, classSubjectId);

    if (!removed) throw AppError.notFound('Disciplina da turma');
  },

  // --- Convites ------------------------------------------------------------------

  async createInvite(
    userId: string,
    classId: string,
    input: CreateClassInviteInput,
  ): Promise<ClassInviteCreated> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);
    await assertNotArchived(classId);

    const memberCount = await classRepository.countActiveMembers(classId);

    if (memberCount >= MAX_MEMBERS_PER_CLASS) {
      throw AppError.conflict(`Esta turma já atingiu o limite de ${MAX_MEMBERS_PER_CLASS} membros`);
    }

    const token = randomToken(24);
    const tokenHash = hashToken(token);

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const row = await classRepository.createInvite(classId, userId, {
      tokenHash,
      expiresAt,
      maxUses: input.maxUses ?? null,
    });

    return {
      id: row.id,
      token,
      joinUrl: `${env.WEB_APP_URL}/turmas/entrar/${token}`,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      maxUses: row.maxUses,
    };
  },

  async listInvites(userId: string, classId: string): Promise<ClassInviteItem[]> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const rows = await classRepository.listInvites(classId);

    return rows.map(toInviteItem);
  },

  async revokeInvite(userId: string, classId: string, inviteId: string): Promise<void> {
    const role = await requireMembership(userId, classId);
    requireOwner(role);

    const revoked = await classRepository.revokeInvite(classId, inviteId);

    if (!revoked) throw AppError.notFound('Convite');
  },

  // --- Previa do convite (antes de entrar) ----------------------------------------

  async previewInvite(userId: string, token: string): Promise<ClassInvitePreview> {
    const invite = await this.resolveValidInvite(token);

    const membership = await classRepository.findMembership(userId, invite.classId);
    const memberCount = await classRepository.countActiveMembers(invite.classId);
    const subjectCount = await classRepository.countSubjects(invite.classId);

    return {
      class: {
        id: invite.class.id,
        name: invite.class.name,
        year: invite.class.semester.year,
        term: invite.class.semester.term,
        period: invite.class.period,
        color: invite.class.color,
      },
      owner: { name: invite.class.owner.name },
      memberCount,
      subjectCount,
      alreadyMember: membership?.status === 'ACTIVE',
    };
  },

  /** Valida o convite (existencia, revogacao, expiracao, esgotamento) e devolve a linha. */
  async resolveValidInvite(token: string) {
    const invite = await classRepository.findInviteByHash(hashToken(token));

    if (!invite) throw AppError.notFound('Convite');
    if (invite.revokedAt) throw AppError.conflict('Este convite foi revogado');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw AppError.conflict('Este convite expirou');
    }
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw AppError.conflict('Este convite já atingiu o limite de usos');
    }
    if (invite.class.archivedAt) throw AppError.conflict('Esta turma foi arquivada');

    return invite;
  },

  maxMembersPerClass: MAX_MEMBERS_PER_CLASS,
};
