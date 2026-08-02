import {
  buildPaginationMeta,
  type CreateSubjectInput,
  type PaginatedResult,
  type SubjectDeletionImpact,
  type SubjectDetail,
  type SubjectListItem,
  type SubjectQuery,
  type UpdateSubjectInput,
} from '@painel/shared';
import { type Prisma } from '../config/prisma.js';
import {
  subjectRepository,
  type SubjectDetailRow,
  type SubjectListRow,
} from '../repositories/subject.repository.js';
import { teacherService } from './teacher.service.js';
import { AppError } from '../utils/app-error.js';
import { attachmentService } from './attachment.service.js';
import { calculateRequiredGrade, calculateWeightedAverage } from '../utils/grade-calculator.js';
import { emptyToNull } from '../utils/text.js';

/**
 * Regra de negocio de disciplinas.
 *
 * Concentra a media, as contagens e a politica de exclusao. Os controllers
 * apenas repassam dados ja validados.
 */

/** Campos de texto opcionais chegam como '' do formulario; o banco guarda null. */
function toListItem(
  row: SubjectListRow,
  counts: { pendingAssignments: number; upcomingExams: number },
): SubjectListItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    room: row.room,
    credits: row.credits,
    passingGrade: row.passingGrade,
    status: row.status,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    teacher: row.teacher,
    semester: row.semester,
    // Disciplina encerrada tem media consolidada em `finalGrade`; so quando
    // ela nao existe a media e derivada das notas lancadas. Sem isso, uma
    // disciplina do historico apareceria sem media.
    average: row.finalGrade ?? calculateWeightedAverage(row.grades),
    assignmentCount: row._count.assignments,
    pendingAssignmentCount: counts.pendingAssignments,
    examCount: row._count.exams,
    upcomingExamCount: counts.upcomingExams,
    gradeCount: row._count.grades,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(
  row: SubjectDetailRow,
  counts: { pendingAssignments: number; upcomingExams: number },
): SubjectDetail {
  const average = calculateWeightedAverage(row.grades);

  /**
   * Peso restante estimado.
   *
   * Sem um plano de avaliacoes cadastrado, assumimos que o semestre soma peso
   * 10 no total; o que sobra desse valor e o que ainda sera avaliado. E uma
   * estimativa, refinada na Etapa 10 quando as avaliacoes forem planejadas.
   */
  const usedWeight = row.grades.reduce((total, grade) => total + (grade.weight || 1), 0);
  const remainingWeight = Math.max(10 - usedWeight, 0);

  return {
    ...toListItem(row, counts),
    description: row.description,
    classroomLink: row.classroomLink,
    googleCourseId: row.googleCourseId,
    requiredGrade:
      average === null || remainingWeight === 0
        ? null
        : calculateRequiredGrade(row.grades, row.passingGrade, remainingWeight),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Anexa as contagens de pendentes/futuras a cada linha. */
async function decorate(userId: string, rows: SubjectListRow[]): Promise<SubjectListItem[]> {
  const counts = await subjectRepository.countsByStatus(
    userId,
    rows.map((row) => row.id),
  );

  return rows.map((row) =>
    toListItem(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 }),
  );
}

export const subjectService = {
  /**
   * Listagem paginada.
   *
   * Ordenar por `average` exige tratamento proprio: a media e derivada das
   * notas e nao existe como coluna, entao o banco nao consegue ordena-la.
   * Nesse caso buscamos o conjunto filtrado, calculamos e paginamos em
   * memoria - viavel porque o total de disciplinas por usuario e pequeno
   * (dezenas, nao milhares).
   */
  async list(userId: string, query: SubjectQuery): Promise<PaginatedResult<SubjectListItem>> {
    const filters = {
      search: query.search,
      semesterId: query.semesterId,
      status: query.status,
      includeArchived: query.includeArchived,
    };

    const skip = (query.page - 1) * query.perPage;

    if (query.sortBy === 'average') {
      const rows = await subjectRepository.findAllFiltered(userId, filters);
      const items = await decorate(userId, rows);

      const sorted = items.sort((a, b) => {
        // Disciplinas sem nota vao para o fim em qualquer direcao: sao
        // ausencia de informacao, nao a menor media.
        if (a.average === null && b.average === null) return a.name.localeCompare(b.name);
        if (a.average === null) return 1;
        if (b.average === null) return -1;

        return query.order === 'asc' ? a.average - b.average : b.average - a.average;
      });

      return {
        data: sorted.slice(skip, skip + query.perPage),
        meta: buildPaginationMeta(query.page, query.perPage, sorted.length),
      };
    }

    const orderBy: Prisma.SubjectOrderByWithRelationInput =
      query.sortBy === 'code'
        ? { code: query.order }
        : query.sortBy === 'createdAt'
          ? { createdAt: query.order }
          : { name: query.order };

    const { rows, total } = await subjectRepository.findPaginated(
      userId,
      filters,
      orderBy,
      skip,
      query.perPage,
    );

    return {
      data: await decorate(userId, rows),
      meta: buildPaginationMeta(query.page, query.perPage, total),
    };
  },

  async getById(userId: string, id: string): Promise<SubjectDetail> {
    const row = await subjectRepository.findById(userId, id);

    if (!row) throw AppError.notFound('Disciplina');

    const counts = await subjectRepository.countsByStatus(userId, [row.id]);

    return toDetail(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 });
  },

  async create(userId: string, input: CreateSubjectInput): Promise<SubjectDetail> {
    const semesterId = input.semesterId ?? null;

    const duplicate = await subjectRepository.findByNameInSemester(userId, input.name, semesterId);

    if (duplicate) {
      throw AppError.conflict('Já existe uma disciplina com este nome neste semestre');
    }

    const teacherId = await this.resolveTeacherId(userId, input.teacherId, input.newTeacherName);

    const row = await subjectRepository.create(userId, {
      name: input.name,
      code: emptyToNull(input.code),
      description: emptyToNull(input.description),
      color: input.color,
      room: emptyToNull(input.room),
      credits: input.credits ?? null,
      passingGrade: input.passingGrade,
      status: input.status,
      ...(semesterId ? { semester: { connect: { id: semesterId } } } : {}),
      ...(teacherId ? { teacher: { connect: { id: teacherId } } } : {}),
    });

    const counts = await subjectRepository.countsByStatus(userId, [row.id]);

    return toDetail(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 });
  },

  async update(userId: string, id: string, input: UpdateSubjectInput): Promise<SubjectDetail> {
    const current = await subjectRepository.findById(userId, id);

    if (!current) throw AppError.notFound('Disciplina');

    if (input.name) {
      const semesterId =
        input.semesterId !== undefined ? input.semesterId : (current.semester?.id ?? null);

      const duplicate = await subjectRepository.findByNameInSemester(
        userId,
        input.name,
        semesterId,
        id,
      );

      if (duplicate) {
        throw AppError.conflict('Já existe uma disciplina com este nome neste semestre');
      }
    }

    // `Unchecked` expoe `semesterId`/`teacherId` como escalares, unico formato
    // aceito por `updateMany`.
    const data: Prisma.SubjectUncheckedUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: emptyToNull(input.code) } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.room !== undefined ? { room: emptyToNull(input.room) } : {}),
      ...(input.credits !== undefined ? { credits: input.credits ?? null } : {}),
      ...(input.passingGrade !== undefined ? { passingGrade: input.passingGrade } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };

    if (input.semesterId !== undefined) {
      data.semesterId = input.semesterId ?? null;
    }

    if (input.teacherId !== undefined || input.newTeacherName) {
      // `null` desvincula o professor; a disciplina continua existindo.
      data.teacherId = await this.resolveTeacherId(userId, input.teacherId, input.newTeacherName);
    }

    const row = await subjectRepository.update(userId, id, data);

    if (!row) throw AppError.notFound('Disciplina');

    const counts = await subjectRepository.countsByStatus(userId, [row.id]);

    return toDetail(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 });
  },

  /**
   * Arquiva a disciplina.
   *
   * E a acao padrao ao "excluir": preserva provas, notas e materiais, e pode
   * ser desfeita. A remocao definitiva exige pedido explicito.
   */
  async archive(userId: string, id: string): Promise<SubjectDetail> {
    const row = await subjectRepository.archive(userId, id);

    if (!row) throw AppError.notFound('Disciplina');

    const counts = await subjectRepository.countsByStatus(userId, [row.id]);

    return toDetail(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 });
  },

  async restore(userId: string, id: string): Promise<SubjectDetail> {
    const row = await subjectRepository.restore(userId, id);

    if (!row) throw AppError.notFound('Disciplina');

    const counts = await subjectRepository.countsByStatus(userId, [row.id]);

    return toDetail(row, counts.get(row.id) ?? { pendingAssignments: 0, upcomingExams: 0 });
  },

  /**
   * Exclusao permanente.
   *
   * O cascade do schema remove provas, notas e anexos junto. A interface
   * mostra o impacto antes de confirmar.
   */
  async remove(userId: string, id: string): Promise<void> {
    // Os arquivos precisam sair ANTES: depois do delete o banco ja apagou as
    // linhas de Attachment por cascata e nao ha mais como descobrir as chaves.
    await attachmentService.purgeStorageForOwner(userId, { kind: 'subject', id });

    const deleted = await subjectRepository.delete(userId, id);

    if (!deleted) throw AppError.notFound('Disciplina');
  },

  async getDeletionImpact(userId: string, id: string): Promise<SubjectDeletionImpact> {
    const exists = await subjectRepository.findById(userId, id);

    if (!exists) throw AppError.notFound('Disciplina');

    return subjectRepository.countRelated(userId, id);
  },

  /**
   * Decide qual professor vincular.
   *
   * `teacherId` tem prioridade; `newTeacherName` cria (ou reaproveita, quando
   * o nome ja existe) o professor. Sem nenhum dos dois, a disciplina fica sem
   * professor.
   */
  async resolveTeacherId(
    userId: string,
    teacherId: string | null | undefined,
    newTeacherName: string | undefined,
  ): Promise<string | null> {
    if (teacherId) return teacherId;

    const name = newTeacherName?.trim();

    if (!name) return null;

    const teacher = await teacherService.findOrCreateByName(userId, name);

    return teacher.id;
  },
};
