import type { SyncReport } from '@painel/shared';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type {
  ClassroomClient,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomDate,
  ClassroomMaterial,
  ClassroomSubmission,
  ClassroomTeacher,
  ClassroomTimeOfDay,
} from '../integrations/classroom/classroom.types.js';
import { semesterRepository } from '../repositories/semester.repository.js';

/**
 * Importacao do Google Classroom.
 *
 * Recebe o cliente por parametro em vez de instancia-lo: isso permite exercitar
 * deduplicacao e politica de merge com um cliente simulado, sem depender de uma
 * conta Google real. Sao justamente esses dois pontos onde bugs de
 * sincronizacao aparecem.
 *
 * POLITICA DE MERGE
 * -----------------
 * Campos que pertencem ao Classroom (titulo, descricao, prazo, estado, pontos,
 * anexos) sao sobrescritos a cada sincronizacao.
 *
 * Campos que pertencem ao usuario sao PRESERVADOS:
 * - prioridade e observacoes, que ele definiu aqui;
 * - status, porque marcar uma atividade como concluida jamais pode ser
 *   desfeito por uma sincronizacao.
 */

/** Paleta usada para dar cores distintas as turmas importadas. */
const IMPORT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

/**
 * Converte data + hora do Classroom em Date.
 *
 * O Classroom entrega a data em campos separados e SEM fuso; a hora vem em
 * UTC. Sem hora definida, assumimos o fim do dia - e o que "entregar ate dia
 * 15" significa na pratica.
 */
function toDueDate(date?: ClassroomDate, time?: ClassroomTimeOfDay): Date | null {
  if (!date?.year || !date.month || !date.day) return null;

  if (!time || (time.hours === undefined && time.minutes === undefined)) {
    return new Date(date.year, date.month - 1, date.day, 23, 59, 59);
  }

  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, time.hours ?? 0, time.minutes ?? 0, 0),
  );
}

/** Extrai os anexos utilizaveis de um item do Classroom. */
function extractAttachments(
  materials: ClassroomMaterial[] | undefined,
): Array<{ name: string; url: string; type: 'LINK' | 'DOCUMENT'; googleDriveId: string | null }> {
  if (!materials?.length) return [];

  const result: Array<{
    name: string;
    url: string;
    type: 'LINK' | 'DOCUMENT';
    googleDriveId: string | null;
  }> = [];

  for (const material of materials) {
    if (material.driveFile?.driveFile?.alternateLink) {
      result.push({
        name: material.driveFile.driveFile.title ?? 'Arquivo do Drive',
        url: material.driveFile.driveFile.alternateLink,
        type: 'DOCUMENT',
        googleDriveId: material.driveFile.driveFile.id ?? null,
      });
      continue;
    }

    if (material.link?.url) {
      result.push({
        name: material.link.title ?? material.link.url,
        url: material.link.url,
        type: 'LINK',
        googleDriveId: null,
      });
      continue;
    }

    if (material.youtubeVideo?.alternateLink) {
      result.push({
        name: material.youtubeVideo.title ?? 'Vídeo do YouTube',
        url: material.youtubeVideo.alternateLink,
        type: 'LINK',
        googleDriveId: null,
      });
      continue;
    }

    if (material.form?.formUrl) {
      result.push({
        name: material.form.title ?? 'Formulário',
        url: material.form.formUrl,
        type: 'LINK',
        googleDriveId: null,
      });
    }
  }

  return result;
}

/** Nome do professor conforme o perfil devolvido pelo Classroom. */
function teacherName(profile?: { name?: { fullName?: string }; emailAddress?: string }): string {
  return profile?.name?.fullName ?? profile?.emailAddress ?? 'Professor';
}

export const classroomSyncService = {
  /**
   * Executa a sincronizacao completa.
   *
   * Uma turma que falhar nao aborta as demais: o erro entra em `warnings` e o
   * restante continua. Sincronizacao parcial e melhor que nenhuma.
   */
  async sync(userId: string, client: ClassroomClient): Promise<SyncReport> {
    const startedAt = new Date();

    const report: SyncReport = {
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      durationMs: 0,
      subjects: { created: 0, updated: 0 },
      teachers: { created: 0, updated: 0 },
      assignments: { created: 0, updated: 0, skipped: 0 },
      attachments: { created: 0 },
      warnings: [],
    };

    const courses = await client.listCourses();

    logger.info('Classroom: turmas encontradas', { userId, count: courses.length });

    // Disciplinas importadas entram no semestre atual, quando houver.
    const semester = await semesterRepository.findCurrent(userId);

    for (const [index, course] of courses.entries()) {
      try {
        await this.syncCourse(userId, client, course, index, semester?.id ?? null, report);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';

        report.warnings.push(`Turma "${course.name}": ${message}`);
        logger.warn('Classroom: falha ao sincronizar turma', {
          userId,
          course: course.id,
          message,
        });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { classroomSyncedAt: new Date() },
    });

    const finishedAt = new Date();
    report.finishedAt = finishedAt.toISOString();
    report.durationMs = finishedAt.getTime() - startedAt.getTime();

    logger.info('Classroom: sincronizacao concluida', { userId, ...report.subjects });

    return report;
  },

  /** Importa uma turma: disciplina, professor e atividades. */
  async syncCourse(
    userId: string,
    client: ClassroomClient,
    course: ClassroomCourse,
    index: number,
    semesterId: string | null,
    report: SyncReport,
  ): Promise<void> {
    // --- Professor -------------------------------------------------------------
    let teacherId: string | null = null;

    /**
     * O professor e um dado ACESSORIO: `Subject.teacherId` e anulavel, e a
     * disciplina com suas atividades vale por si so.
     *
     * Por isso a falha aqui nao pode abortar a turma. Na pratica o Google
     * responde 500 neste endpoint quando o aluno nao tem permissao de ver os
     * perfis do diretorio da instituicao - o que fazia a turma inteira, com
     * todas as atividades, deixar de ser importada por causa de um nome.
     */
    const teachers = await client.listTeachers(course.id).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'erro desconhecido';

      report.warnings.push(
        `Turma "${course.name}": importada sem o professor (${message.replace(/\.$/, '')})`,
      );
      logger.warn('Classroom: falha ao listar professores', {
        userId,
        course: course.id,
        message,
      });

      return [] as ClassroomTeacher[];
    });

    // O Classroom lista varios professores; o dono da turma e o principal.
    const owner = teachers.find((t) => t.userId === course.ownerId) ?? teachers[0];

    if (owner) {
      const name = teacherName(owner.profile);
      const email = owner.profile?.emailAddress ?? null;

      // `@@unique([userId, googleUserId])` garante idempotencia: reimportar a
      // mesma turma atualiza o professor em vez de criar duplicata.
      const existing = await prisma.teacher.findFirst({
        where: { userId, googleUserId: owner.userId },
      });

      if (existing) {
        await prisma.teacher.update({
          where: { id: existing.id },
          data: { name, email },
        });
        teacherId = existing.id;
        report.teachers.updated += 1;
      } else {
        const created = await prisma.teacher.create({
          data: { userId, name, email, googleUserId: owner.userId },
        });
        teacherId = created.id;
        report.teachers.created += 1;
      }
    }

    // --- Disciplina --------------------------------------------------------------
    const existingSubject = await prisma.subject.findFirst({
      where: { userId, googleCourseId: course.id },
    });

    let subjectId: string;

    if (existingSubject) {
      await prisma.subject.update({
        where: { id: existingSubject.id },
        data: {
          name: course.name,
          room: course.room ?? existingSubject.room,
          classroomLink: course.alternateLink ?? null,
          teacherId: teacherId ?? existingSubject.teacherId,
          // Cor NAO e sobrescrita: se o usuario escolheu outra, ela e dele.
        },
      });
      subjectId = existingSubject.id;
      report.subjects.updated += 1;
    } else {
      const created = await prisma.subject.create({
        data: {
          userId,
          name: course.name,
          code: course.section ?? null,
          room: course.room ?? null,
          color: IMPORT_COLORS[index % IMPORT_COLORS.length] ?? '#6366f1',
          googleCourseId: course.id,
          classroomLink: course.alternateLink ?? null,
          teacherId,
          semesterId,
        },
      });
      subjectId = created.id;
      report.subjects.created += 1;
    }

    // --- Atividades ----------------------------------------------------------------
    const [courseWork, submissions] = await Promise.all([
      client.listCourseWork(course.id),
      client.listSubmissions(course.id).catch(() => [] as ClassroomSubmission[]),
    ]);

    const submissionByWork = new Map(submissions.map((s) => [s.courseWorkId, s]));

    for (const work of courseWork) {
      // Rascunhos e itens apagados no Classroom nao viram atividade.
      if (work.state === 'DELETED' || work.state === 'DRAFT') {
        report.assignments.skipped += 1;
        continue;
      }

      await this.syncCourseWork(userId, subjectId, work, submissionByWork.get(work.id), report);
    }
  },

  /**
   * Importa uma atividade, respeitando o que o usuario definiu localmente.
   */
  async syncCourseWork(
    userId: string,
    subjectId: string,
    work: ClassroomCourseWork,
    submission: ClassroomSubmission | undefined,
    report: SyncReport,
  ): Promise<void> {
    const dueDate = toDueDate(work.dueDate, work.dueTime);

    // `@@unique([userId, googleCourseWorkId])` e o que impede duplicacao.
    const existing = await prisma.assignment.findFirst({
      where: { userId, googleCourseWorkId: work.id },
    });

    /**
     * Entregue no Classroom conta como concluida aqui.
     *
     * Vale apenas na criacao e para MARCAR como concluida - nunca para
     * desmarcar: quem concluiu na mao nao pode ter isso revertido.
     */
    const turnedIn = submission?.state === 'TURNED_IN' || submission?.state === 'RETURNED';

    const classroomFields = {
      title: work.title,
      description: work.description ?? null,
      dueDate,
      classroomState: work.state ?? null,
      classroomLink: work.alternateLink ?? null,
      maxPoints: work.maxPoints ?? null,
      syncedAt: new Date(),
      subjectId,
    };

    let assignmentId: string;

    if (existing) {
      await prisma.assignment.update({
        where: { id: existing.id },
        data: {
          ...classroomFields,
          // Prioridade, observacoes e status permanecem como estao. A unica
          // mudanca de status permitida e concluir algo entregue no Classroom.
          ...(turnedIn && existing.status !== 'COMPLETED'
            ? { status: 'COMPLETED' as const, completedAt: new Date() }
            : {}),
        },
      });
      assignmentId = existing.id;
      report.assignments.updated += 1;
    } else {
      const created = await prisma.assignment.create({
        data: {
          userId,
          ...classroomFields,
          source: 'GOOGLE_CLASSROOM',
          priority: 'MEDIUM',
          status: turnedIn ? 'COMPLETED' : 'PENDING',
          completedAt: turnedIn ? new Date() : null,
          googleCourseWorkId: work.id,
        },
      });
      assignmentId = created.id;
      report.assignments.created += 1;
    }

    // --- Anexos -----------------------------------------------------------------
    const attachments = extractAttachments(work.materials);

    for (const attachment of attachments) {
      // Deduplicacao por URL: o Classroom nao da id estavel para o material
      // dentro da atividade, e a URL cumpre esse papel.
      const alreadyImported = await prisma.attachment.findFirst({
        where: { userId, assignmentId, url: attachment.url },
      });

      if (alreadyImported) continue;

      await prisma.attachment.create({
        data: {
          userId,
          assignmentId,
          subjectId,
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
          source: attachment.googleDriveId ? 'GOOGLE_DRIVE' : 'GOOGLE_CLASSROOM',
          googleDriveId: attachment.googleDriveId,
        },
      });

      report.attachments.created += 1;
    }
  },
};
