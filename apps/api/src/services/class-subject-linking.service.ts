import { classRepository } from '../repositories/class.repository.js';
import { semesterRepository } from '../repositories/semester.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { gradeConfigurationService } from './grade-configuration.service.js';
import { semesterService } from './semester.service.js';
import { matchClassSubjects } from '../utils/class-subject-merge.js';

/**
 * Datas padrao de um semestre criado a partir de uma turma.
 *
 * So um ponto de partida - o membro (ou o dono) pode ajustar depois em
 * Histórico, como qualquer outro semestre. Segue o calendario acadêmico
 * brasileiro mais comum: periodo 1 de fevereiro a julho, periodo 2 de agosto
 * a dezembro.
 */
function defaultSemesterDates(year: number, term: number): { startDate: Date; endDate: Date } {
  return term === 1
    ? { startDate: new Date(year, 1, 1), endDate: new Date(year, 6, 15) }
    : { startDate: new Date(year, 6, 16), endDate: new Date(year, 11, 20) };
}

/**
 * Acha o semestre PESSOAL do usuario para este ano/período, criando-o se
 * necessário.
 *
 * Usado tanto por quem entra numa turma quanto pelo próprio dono ao criá-la -
 * o dono também é um `ClassMember` (role OWNER) e precisa do mesmo semestre
 * resolvido, ou fica de fora do *fan-out* das suas próprias publicações.
 */
export async function resolveMemberSemester(
  userId: string,
  year: number,
  term: number,
): Promise<{ id: string; name: string }> {
  const existing = await semesterRepository.findByYearTerm(userId, year, term);

  if (existing) {
    const row = await semesterRepository.findById(userId, existing.id);

    return { id: row!.id, name: row!.name };
  }

  const name = `${year}.${String(term).padStart(2, '0')}`;
  const { startDate, endDate } = defaultSemesterDates(year, term);

  const created = await semesterService.create(userId, {
    name,
    year,
    term,
    status: 'ACTIVE',
    isCurrent: false,
    startDate,
    endDate,
  });

  return { id: created.id, name: created.name };
}

export interface ClassSubjectTemplate {
  id: string;
  name: string;
  code: string | null;
  color: string;
  teacherName: string | null;
  credits: number | null;
}

/**
 * Garante que o membro tenha uma `Subject` vinculada a este molde de turma,
 * casando por nome (achou -> vincula; não achou -> cria) ou reaproveitando um
 * vínculo já existente.
 *
 * Compartilhado por três gatilhos que precisam da MESMA decisão de casamento,
 * ou um membro acabaria com duas disciplinas para a mesma matéria:
 * - entrar na turma (Etapa 20);
 * - o dono adicionar uma disciplina nova numa turma que já tem membros
 *   (backfill retroativo, `class.service.addSubject`);
 * - publicar algo vinculado a uma disciplina que um membro específico ainda
 *   não tinha (Etapa 21, `class-post.service`).
 *
 * **Reconciliação (Etapa 24):** um vínculo existente só é reaproveitado se a
 * `Subject` do outro lado ainda estiver ativa. Se o membro a arquivou depois
 * de vinculada, o vínculo sobrevive apontando para ela (nada apaga sozinho),
 * mas fica *stale* - uma publicação nova cairia silenciosamente numa
 * disciplina arquivada. Aqui o casamento roda de novo e o vínculo é
 * REPOSICIONADO (`relinkSubject`), nunca duplicado - o `@@unique` já garante
 * no máximo um vínculo por (molde, membro).
 */
export async function ensureMemberSubjectLink(
  userId: string,
  semesterId: string,
  classMemberId: string,
  classSubject: ClassSubjectTemplate,
): Promise<{ subjectId: string; created: boolean }> {
  const existingLink = await classRepository.findLinkedSubject(classSubject.id, userId);

  if (existingLink && !existingLink.archivedAt) {
    return { subjectId: existingLink.subjectId, created: false };
  }

  const existingSubjects = await classRepository.findUserSubjectsForMatch(userId, semesterId);
  const [match] = matchClassSubjects(
    [{ id: classSubject.id, name: classSubject.name }],
    existingSubjects,
  );

  let subjectId: string;
  let created: boolean;

  if (match?.action === 'link') {
    subjectId = match.subjectId;
    created = false;
  } else {
    const gradeConfig = await gradeConfigurationService.resolveInitialConfiguration(
      userId,
      semesterId,
    );

    const row = await subjectRepository.createWithGradeConfiguration(
      userId,
      {
        name: classSubject.name,
        code: classSubject.code,
        color: classSubject.color,
        credits: classSubject.credits,
        semester: { connect: { id: semesterId } },
      },
      gradeConfig,
    );

    subjectId = row.id;
    created = true;
  }

  if (existingLink) {
    await classRepository.relinkSubject(classSubject.id, userId, subjectId);
  } else {
    await classRepository.createLink(classSubject.id, userId, subjectId, classMemberId);
  }

  return { subjectId, created };
}
