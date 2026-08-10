import type { GradeConfigurationInput, GradeConfigurationItem } from '@painel/shared';
import {
  gradeConfigurationRepository,
  type GradeConfigurationRow,
} from '../repositories/grade-configuration.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { semesterRepository } from '../repositories/semester.repository.js';
import { AppError } from '../utils/app-error.js';

/**
 * Regra de negocio de configuracao de notas (Etapa 17).
 *
 * O sistema nao sabe que existem "N1/N2/N3" - sabe que existem componentes
 * de avaliacao configuraveis. Uma disciplina sempre tem sua propria
 * configuracao (criada junto com ela, ver `subjectService.create`); um
 * semestre pode ter um modelo padrao, usado so para pre-preencher
 * disciplinas novas - editar a configuracao de uma disciplina depois nunca
 * afeta o modelo nem outras disciplinas.
 */

function toItem(row: GradeConfigurationRow): GradeConfigurationItem {
  return {
    id: row.id,
    passingGrade: row.passingGrade,
    components: row.components.map((component) => ({
      id: component.id,
      name: component.name,
      weight: component.weight,
      order: component.order,
      hasGrade: component._count.grades > 0,
    })),
  };
}

/**
 * Aplica a substituicao dos componentes.
 *
 * Componentes ausentes do payload sao excluidos - mas nunca um que ja tenha
 * nota lancada: o erro precisa dizer qual componente e por que, em vez de
 * estourar como violacao de constraint no banco.
 */
async function applyReplace(
  userId: string,
  config: GradeConfigurationRow,
  input: GradeConfigurationInput,
): Promise<GradeConfigurationItem> {
  const keepIds = new Set(
    input.components.filter((component) => component.id).map((component) => component.id as string),
  );
  const toDelete = config.components.filter((component) => !keepIds.has(component.id));
  const blocked = toDelete.filter((component) => component._count.grades > 0);

  if (blocked.length > 0) {
    const names = blocked.map((component) => `"${component.name}"`).join(', ');

    throw AppError.conflict(
      blocked.length === 1
        ? `O componente ${names} já tem nota lançada — exclua a nota antes de remover o componente.`
        : `Os componentes ${names} já têm nota lançada — exclua as notas antes de removê-los.`,
    );
  }

  const row = await gradeConfigurationRepository.replace(
    userId,
    config.id,
    input.passingGrade,
    input.components,
    toDelete.map((component) => component.id),
  );

  return toItem(row);
}

async function assertSubjectOwnership(userId: string, subjectId: string): Promise<void> {
  const subject = await subjectRepository.findById(userId, subjectId);

  if (!subject) throw AppError.notFound('Disciplina');
}

async function assertSemesterOwnership(userId: string, semesterId: string): Promise<void> {
  const semester = await semesterRepository.findById(userId, semesterId);

  if (!semester) throw AppError.notFound('Semestre');
}

/**
 * Modelo padrao "de fabrica" (Etapa 19): N1/N2/N3 com os pesos comuns na
 * maioria das instituicoes brasileiras (3/4/3, aprovacao 6). Usado so para
 * dar um ponto de partida ao usuario novo - ele pode apagar ou reconfigurar
 * tudo depois, tanto quanto qualquer outra configuracao.
 */
const FACTORY_DEFAULT_COMPONENTS = [
  { name: 'N1', weight: 3 },
  { name: 'N2', weight: 4 },
  { name: 'N3', weight: 3 },
];
const FACTORY_DEFAULT_PASSING_GRADE = 6;

export const gradeConfigurationService = {
  async getForSubject(userId: string, subjectId: string): Promise<GradeConfigurationItem> {
    await assertSubjectOwnership(userId, subjectId);

    const row = await gradeConfigurationRepository.findBySubject(userId, subjectId);

    // Nao deveria acontecer - toda disciplina ganha uma configuracao ao ser
    // criada (subjectService.create). Defensivo contra dado legado/corrompido.
    if (!row) throw AppError.notFound('Configuração de notas');

    return toItem(row);
  },

  async replaceForSubject(
    userId: string,
    subjectId: string,
    input: GradeConfigurationInput,
  ): Promise<GradeConfigurationItem> {
    await assertSubjectOwnership(userId, subjectId);

    const row = await gradeConfigurationRepository.findBySubject(userId, subjectId);

    if (!row) throw AppError.notFound('Configuração de notas');

    return applyReplace(userId, row, input);
  },

  /** `null` quando o semestre ainda nao tem um modelo padrao definido. */
  async getTemplateForSemester(
    userId: string,
    semesterId: string,
  ): Promise<GradeConfigurationItem | null> {
    await assertSemesterOwnership(userId, semesterId);

    const row = await gradeConfigurationRepository.findByTemplateSemester(userId, semesterId);

    return row ? toItem(row) : null;
  },

  async replaceTemplateForSemester(
    userId: string,
    semesterId: string,
    input: GradeConfigurationInput,
  ): Promise<GradeConfigurationItem> {
    await assertSemesterOwnership(userId, semesterId);

    const existing = await gradeConfigurationRepository.findByTemplateSemester(userId, semesterId);

    if (!existing) {
      const created = await gradeConfigurationRepository.create(
        userId,
        { semesterId },
        input.passingGrade,
        input.components,
      );

      return toItem(created);
    }

    return applyReplace(userId, existing, input);
  },

  /** `null` quando o usuario ainda nao tem um modelo pessoal (nao deveria acontecer - ver `ensureUserDefault`). */
  async getUserDefault(userId: string): Promise<GradeConfigurationItem | null> {
    const row = await gradeConfigurationRepository.findUserDefault(userId);

    return row ? toItem(row) : null;
  },

  async replaceUserDefault(
    userId: string,
    input: GradeConfigurationInput,
  ): Promise<GradeConfigurationItem> {
    const existing = await gradeConfigurationRepository.findUserDefault(userId);

    if (!existing) {
      const created = await gradeConfigurationRepository.create(
        userId,
        { defaultForUserId: userId },
        input.passingGrade,
        input.components,
      );

      return toItem(created);
    }

    return applyReplace(userId, existing, input);
  },

  /**
   * Garante que o usuario tenha um modelo pessoal padrao, criando o modelo
   * "de fabrica" (N1/N2/N3) se ainda nao existir. Chamado no primeiro login
   * (Etapa 19) - idempotente, entao chamar de novo em um usuario que ja tem
   * modelo simplesmente nao faz nada.
   */
  async ensureUserDefault(userId: string): Promise<void> {
    const existing = await gradeConfigurationRepository.findUserDefault(userId);

    if (existing) return;

    await gradeConfigurationRepository.create(
      userId,
      { defaultForUserId: userId },
      FACTORY_DEFAULT_PASSING_GRADE,
      FACTORY_DEFAULT_COMPONENTS,
    );
  },

  /**
   * Configuracao inicial de uma disciplina nova: copia do modelo do
   * semestre quando existir; sem isso, cai no modelo pessoal do usuario
   * (Etapa 19); sem nenhum dos dois, comeca vazia (o usuario configura
   * depois).
   *
   * So le o modelo - quem efetivamente cria a configuracao da disciplina e
   * `subjectRepository.createWithGradeConfiguration`, na mesma transacao que
   * cria a disciplina.
   */
  async resolveInitialConfiguration(
    userId: string,
    semesterId: string | null,
  ): Promise<{ passingGrade: number; components: Array<{ name: string; weight: number }> }> {
    const template = semesterId
      ? await gradeConfigurationRepository.findByTemplateSemester(userId, semesterId)
      : null;

    const source = template ?? (await gradeConfigurationRepository.findUserDefault(userId));

    if (!source) return { passingGrade: 6, components: [] };

    return {
      passingGrade: source.passingGrade,
      components: source.components.map((component) => ({
        name: component.name,
        weight: component.weight,
      })),
    };
  },
};
