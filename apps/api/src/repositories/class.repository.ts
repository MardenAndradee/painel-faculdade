import { prisma, type Prisma } from '../config/prisma.js';
import type { ClassMemberStatus, ClassRole } from '@painel/shared';

/** Acesso a dados de turmas (Etapa 20). */

const classListSelect = {
  id: true,
  name: true,
  year: true,
  term: true,
  color: true,
  archivedAt: true,
  createdAt: true,
  _count: { select: { subjects: true, members: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.ClassSelect;

export type ClassListRow = Prisma.ClassGetPayload<{ select: typeof classListSelect }>;

const classSubjectSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
  teacherName: true,
  credits: true,
  order: true,
  _count: { select: { links: true } },
} satisfies Prisma.ClassSubjectSelect;

export type ClassSubjectRow = Prisma.ClassSubjectGetPayload<{ select: typeof classSubjectSelect }>;

const classDetailSelect = {
  id: true,
  name: true,
  year: true,
  term: true,
  description: true,
  color: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: { where: { status: 'ACTIVE' } } } },
  subjects: { select: classSubjectSelect, orderBy: { order: 'asc' } },
} satisfies Prisma.ClassSelect;

export type ClassDetailRow = Prisma.ClassGetPayload<{ select: typeof classDetailSelect }>;

const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.ClassMemberSelect;

export type ClassMemberRow = Prisma.ClassMemberGetPayload<{ select: typeof memberSelect }>;

const inviteSelect = {
  id: true,
  expiresAt: true,
  maxUses: true,
  useCount: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.ClassInviteSelect;

export type ClassInviteRow = Prisma.ClassInviteGetPayload<{ select: typeof inviteSelect }>;

export interface NewClassSubject {
  name: string;
  code: string | null;
  color: string;
  teacherName: string | null;
  credits: number | null;
}

export const classRepository = {
  /** Turmas em que o usuario e membro ativo (dono incluso, como ClassRole.OWNER). */
  findMyMemberships(userId: string): Promise<Array<{ role: ClassRole; class: ClassListRow }>> {
    return prisma.classMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { role: true, class: { select: classListSelect } },
      orderBy: { class: { createdAt: 'desc' } },
    });
  },

  findMembership(
    userId: string,
    classId: string,
  ): Promise<{ role: ClassRole; status: ClassMemberStatus } | null> {
    return prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { role: true, status: true },
    });
  },

  findDetail(classId: string): Promise<ClassDetailRow | null> {
    return prisma.class.findUnique({ where: { id: classId }, select: classDetailSelect });
  },

  /** Só o nome - usado para compor a mensagem de notificação do Mural. */
  async findClassName(classId: string): Promise<string | null> {
    const row = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });

    return row?.name ?? null;
  },

  /**
   * Cria a turma, o dono como primeiro membro e as disciplinas iniciais numa
   * unica transacao - mesmo padrao de `subjectRepository.createWithGradeConfiguration`.
   */
  create(
    ownerId: string,
    data: { name: string; year: number; term: number; description: string | null; color: string },
    subjects: NewClassSubject[],
  ): Promise<ClassDetailRow> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          ...data,
          owner: { connect: { id: ownerId } },
          members: { create: { userId: ownerId, role: 'OWNER' } },
          subjects: { create: subjects.map((subject, index) => ({ ...subject, order: index })) },
        },
        select: { id: true },
      });

      return tx.class.findUniqueOrThrow({ where: { id: created.id }, select: classDetailSelect });
    });
  },

  async update(classId: string, data: Prisma.ClassUpdateInput): Promise<ClassDetailRow> {
    await prisma.class.update({ where: { id: classId }, data });

    return prisma.class.findUniqueOrThrow({ where: { id: classId }, select: classDetailSelect });
  },

  listMembers(classId: string): Promise<ClassMemberRow[]> {
    return prisma.classMember.findMany({
      where: { classId, status: 'ACTIVE' },
      select: memberSelect,
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  },

  countSubjects(classId: string): Promise<number> {
    return prisma.classSubject.count({ where: { classId } });
  },

  /** Disciplinas-molde no formato que o casamento (`class-subject-merge`) e a criação de cópia consomem. */
  listSubjectsFull(classId: string): Promise<
    Array<{
      id: string;
      name: string;
      code: string | null;
      color: string;
      teacherName: string | null;
      credits: number | null;
    }>
  > {
    return prisma.classSubject.findMany({
      where: { classId },
      select: { id: true, name: true, code: true, color: true, teacherName: true, credits: true },
      orderBy: { order: 'asc' },
    });
  },

  async addSubject(
    classId: string,
    data: NewClassSubject,
    order: number,
  ): Promise<ClassSubjectRow> {
    const created = await prisma.classSubject.create({
      data: { ...data, classId, order },
      select: { id: true },
    });

    return prisma.classSubject.findUniqueOrThrow({
      where: { id: created.id },
      select: classSubjectSelect,
    });
  },

  findSubject(classId: string, subjectId: string): Promise<{ id: string; name: string } | null> {
    return prisma.classSubject.findFirst({
      where: { id: subjectId, classId },
      select: { id: true, name: true },
    });
  },

  async updateSubject(
    classId: string,
    subjectId: string,
    data: Prisma.ClassSubjectUpdateInput,
  ): Promise<ClassSubjectRow | null> {
    const result = await prisma.classSubject.updateMany({
      where: { id: subjectId, classId },
      data,
    });

    if (result.count === 0) return null;

    return prisma.classSubject.findUniqueOrThrow({
      where: { id: subjectId },
      select: classSubjectSelect,
    });
  },

  async removeSubject(classId: string, subjectId: string): Promise<boolean> {
    const result = await prisma.classSubject.deleteMany({ where: { id: subjectId, classId } });

    return result.count > 0;
  },

  /**
   * Propaga o novo nome do molde para toda `Subject` vinculada (decisao do
   * README: renomear no dono propaga, sem `detachedAt` - o membro nao tem
   * como divergir esse campo).
   */
  async propagateSubjectName(classSubjectId: string, name: string): Promise<void> {
    const links = await prisma.classSubjectLink.findMany({
      where: { classSubjectId },
      select: { subjectId: true },
    });

    if (links.length === 0) return;

    await prisma.subject.updateMany({
      where: { id: { in: links.map((link) => link.subjectId) } },
      data: { name },
    });
  },

  // --- Convites --------------------------------------------------------------

  createInvite(
    classId: string,
    createdById: string,
    data: { tokenHash: string; expiresAt: Date | null; maxUses: number | null },
  ): Promise<ClassInviteRow> {
    return prisma.classInvite.create({
      data: { ...data, classId, createdById },
      select: inviteSelect,
    });
  },

  findInviteByHash(tokenHash: string): Promise<
    | (ClassInviteRow & {
        classId: string;
        class: {
          id: string;
          name: string;
          year: number;
          term: number;
          color: string;
          archivedAt: Date | null;
          ownerId: string;
          owner: { name: string };
        };
      })
    | null
  > {
    return prisma.classInvite.findUnique({
      where: { tokenHash },
      select: {
        ...inviteSelect,
        classId: true,
        class: {
          select: {
            id: true,
            name: true,
            year: true,
            term: true,
            color: true,
            archivedAt: true,
            ownerId: true,
            owner: { select: { name: true } },
          },
        },
      },
    });
  },

  listInvites(classId: string): Promise<ClassInviteRow[]> {
    return prisma.classInvite.findMany({
      where: { classId, revokedAt: null },
      select: inviteSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  async revokeInvite(classId: string, inviteId: string): Promise<boolean> {
    const result = await prisma.classInvite.updateMany({
      where: { id: inviteId, classId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  },

  incrementInviteUse(inviteId: string): Promise<Prisma.BatchPayload> {
    return prisma.classInvite.updateMany({
      where: { id: inviteId },
      data: { useCount: { increment: 1 } },
    });
  },

  // --- Membresia / entrada -----------------------------------------------------

  countActiveMembers(classId: string): Promise<number> {
    return prisma.classMember.count({ where: { classId, status: 'ACTIVE' } });
  },

  findMemberRow(
    classId: string,
    userId: string,
  ): Promise<{ id: string; status: ClassMemberStatus; role: ClassRole } | null> {
    return prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { id: true, status: true, role: true },
    });
  },

  createMember(classId: string, userId: string, semesterId: string): Promise<{ id: string }> {
    return prisma.classMember.create({
      data: { classId, userId, semesterId, role: 'MEMBER', status: 'ACTIVE' },
      select: { id: true },
    });
  },

  reactivateMember(memberId: string, semesterId: string): Promise<{ id: string }> {
    return prisma.classMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE', semesterId, joinedAt: new Date(), leftAt: null },
      select: { id: true },
    });
  },

  async setMemberSemester(memberId: string, semesterId: string): Promise<void> {
    await prisma.classMember.update({ where: { id: memberId }, data: { semesterId } });
  },

  async leave(classId: string, userId: string): Promise<boolean> {
    const result = await prisma.classMember.updateMany({
      where: { classId, userId, status: 'ACTIVE' },
      data: { status: 'LEFT', leftAt: new Date() },
    });

    return result.count > 0;
  },

  // --- Casamento de disciplinas --------------------------------------------------

  findUserSubjectsForMatch(
    userId: string,
    semesterId: string,
  ): Promise<Array<{ id: string; name: string; archivedAt: Date | null }>> {
    return prisma.subject.findMany({
      where: { userId, semesterId },
      select: { id: true, name: true, archivedAt: true },
    });
  },

  findExistingLink(classSubjectId: string, userId: string): Promise<{ id: string } | null> {
    return prisma.classSubjectLink.findUnique({
      where: { classSubjectId_userId: { classSubjectId, userId } },
      select: { id: true },
    });
  },

  /** O vínculo existente, se houver, com o estado da `Subject` do outro lado. */
  async findLinkedSubject(
    classSubjectId: string,
    userId: string,
  ): Promise<{ subjectId: string; archivedAt: Date | null } | null> {
    const link = await prisma.classSubjectLink.findUnique({
      where: { classSubjectId_userId: { classSubjectId, userId } },
      select: { subjectId: true, subject: { select: { archivedAt: true } } },
    });

    if (!link) return null;

    return { subjectId: link.subjectId, archivedAt: link.subject.archivedAt };
  },

  /**
   * Reconciliação (Etapa 24): troca o alvo de um vínculo já existente.
   *
   * Usado quando o membro arquivou a `Subject` que estava do outro lado do
   * vínculo - a linha de `ClassSubjectLink` continua existindo (o `@@unique`
   * proíbe uma segunda), só o `subjectId` muda para o que o casamento
   * resolveu de novo.
   */
  async relinkSubject(classSubjectId: string, userId: string, subjectId: string): Promise<void> {
    await prisma.classSubjectLink.update({
      where: { classSubjectId_userId: { classSubjectId, userId } },
      data: { subjectId },
    });
  },

  /** Membros ativos com o semestre já resolvido - todo `ClassMember` ativo tem um. */
  async listActiveMembersWithSemester(
    classId: string,
  ): Promise<Array<{ id: string; userId: string; semesterId: string }>> {
    const rows = await prisma.classMember.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { id: true, userId: true, semesterId: true },
    });

    return rows.filter(
      (row): row is { id: string; userId: string; semesterId: string } => row.semesterId !== null,
    );
  },

  /** O molde completo de uma disciplina da turma - usado ao criar a cópia do membro. */
  findSubjectFull(
    classId: string,
    classSubjectId: string,
  ): Promise<{
    id: string;
    name: string;
    code: string | null;
    color: string;
    teacherName: string | null;
    credits: number | null;
  } | null> {
    return prisma.classSubject.findFirst({
      where: { id: classSubjectId, classId },
      select: { id: true, name: true, code: true, color: true, teacherName: true, credits: true },
    });
  },

  /** Só os ids de usuário dos membros ativos - usado pelo fan-out de notificação do Mural. */
  async listActiveMemberUserIds(classId: string): Promise<string[]> {
    const rows = await prisma.classMember.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { userId: true },
    });

    return rows.map((row) => row.userId);
  },

  createLink(
    classSubjectId: string,
    userId: string,
    subjectId: string,
    classMemberId: string,
  ): Promise<{ id: string }> {
    return prisma.classSubjectLink.create({
      data: { classSubjectId, userId, subjectId, classMemberId },
      select: { id: true },
    });
  },

  /**
   * Disciplinas PESSOAIS do usuário já vinculadas a QUALQUER disciplina-molde
   * desta turma - não importa qual. Usado pra não oferecer, no seletor "já
   * tenho essa disciplina", algo que viraria um segundo vínculo pra mesma
   * disciplina dentro da mesma turma (duplicidade, não erro de nome).
   */
  async listMyLinkedSubjectIds(classId: string, userId: string): Promise<string[]> {
    const rows = await prisma.classSubjectLink.findMany({
      where: { userId, classSubject: { classId } },
      select: { subjectId: true },
    });

    return rows.map((row) => row.subjectId);
  },

  // --- Arquivamento (Etapa 24) -----------------------------------------------------

  async findArchivedAt(classId: string): Promise<Date | null> {
    const row = await prisma.class.findUnique({
      where: { id: classId },
      select: { archivedAt: true },
    });

    return row?.archivedAt ?? null;
  },

  async setArchived(classId: string, archivedAt: Date | null): Promise<void> {
    await prisma.class.update({ where: { id: classId }, data: { archivedAt } });
  },

  // --- Transferência de propriedade (Etapa 24) ---------------------------------------

  /**
   * Troca o dono numa transação: o antigo dono vira MEMBER, o novo vira
   * OWNER, e `Class.ownerId` - usado fora da tabela de membros (ex.: o nome
   * do dono na prévia do convite) - acompanha.
   */
  async transferOwner(
    classId: string,
    currentOwnerMemberId: string,
    newOwnerMemberId: string,
    newOwnerUserId: string,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.classMember.update({ where: { id: currentOwnerMemberId }, data: { role: 'MEMBER' } }),
      prisma.classMember.update({ where: { id: newOwnerMemberId }, data: { role: 'OWNER' } }),
      prisma.class.update({ where: { id: classId }, data: { ownerId: newOwnerUserId } }),
    ]);
  },

  // --- Painel de saúde (Etapa 24) -----------------------------------------------------

  /** Todo par (classSubjectId, userId) já vinculado por um membro ativo. */
  async listActiveLinkPairs(
    classId: string,
  ): Promise<Array<{ classSubjectId: string; userId: string }>> {
    return prisma.classSubjectLink.findMany({
      where: { classSubject: { classId }, classMember: { status: 'ACTIVE' } },
      select: { classSubjectId: true, userId: true },
    });
  },

  /** Vínculos de membro ativo cuja `Subject` do outro lado está arquivada. */
  countArchivedLinkedSubjects(classId: string): Promise<number> {
    return prisma.classSubjectLink.count({
      where: {
        classSubject: { classId },
        classMember: { status: 'ACTIVE' },
        subject: { archivedAt: { not: null } },
      },
    });
  },
};
