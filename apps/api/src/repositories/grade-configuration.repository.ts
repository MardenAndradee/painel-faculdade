import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de configuracao de notas (Etapa 17). */

const componentSelect = {
  id: true,
  name: true,
  weight: true,
  order: true,
  _count: { select: { grades: true } },
} satisfies Prisma.GradeComponentSelect;

const configSelect = {
  id: true,
  passingGrade: true,
  components: { select: componentSelect, orderBy: { order: 'asc' } },
} satisfies Prisma.GradeConfigurationSelect;

export type GradeConfigurationRow = Prisma.GradeConfigurationGetPayload<{
  select: typeof configSelect;
}>;
export type GradeComponentRow = GradeConfigurationRow['components'][number];

export const gradeConfigurationRepository = {
  findBySubject(userId: string, subjectId: string): Promise<GradeConfigurationRow | null> {
    return prisma.gradeConfiguration.findFirst({
      where: { userId, subjectId },
      select: configSelect,
    });
  },

  findByTemplateSemester(
    userId: string,
    semesterId: string,
  ): Promise<GradeConfigurationRow | null> {
    return prisma.gradeConfiguration.findFirst({
      where: { userId, semesterId },
      select: configSelect,
    });
  },

  /** Modelo pessoal padrao do usuario (Etapa 19) - `null` quando ainda nao existe. */
  findUserDefault(userId: string): Promise<GradeConfigurationRow | null> {
    return prisma.gradeConfiguration.findFirst({
      where: { userId, defaultForUserId: userId },
      select: configSelect,
    });
  },

  findById(userId: string, id: string): Promise<GradeConfigurationRow | null> {
    return prisma.gradeConfiguration.findFirst({ where: { id, userId }, select: configSelect });
  },

  /** Cria a configuracao (de uma disciplina, de um modelo de semestre OU do modelo pessoal) com os componentes iniciais. */
  create(
    userId: string,
    owner: { subjectId: string } | { semesterId: string } | { defaultForUserId: string },
    passingGrade: number,
    components: Array<{ name: string; weight: number }>,
  ): Promise<GradeConfigurationRow> {
    return prisma.gradeConfiguration.create({
      data: {
        userId,
        passingGrade,
        ...owner,
        components: {
          create: components.map((component, index) => ({
            userId,
            name: component.name,
            weight: component.weight,
            order: index,
          })),
        },
      },
      select: configSelect,
    });
  },

  /**
   * Substitui o conjunto de componentes e a nota de aprovacao.
   *
   * Puramente mecanico: o service ja decidiu o que pode ser excluido (nenhum
   * componente com nota lancada) antes de chamar isto.
   */
  async replace(
    userId: string,
    configId: string,
    passingGrade: number,
    components: Array<{ id?: string; name: string; weight: number }>,
    deleteIds: string[],
  ): Promise<GradeConfigurationRow> {
    await prisma.$transaction([
      ...(deleteIds.length > 0
        ? [prisma.gradeComponent.deleteMany({ where: { id: { in: deleteIds }, userId } })]
        : []),
      ...components.map((component, index) =>
        component.id
          ? prisma.gradeComponent.updateMany({
              where: { id: component.id, userId },
              data: { name: component.name, weight: component.weight, order: index },
            })
          : prisma.gradeComponent.create({
              data: {
                userId,
                gradeConfigurationId: configId,
                name: component.name,
                weight: component.weight,
                order: index,
              },
            }),
      ),
      prisma.gradeConfiguration.updateMany({
        where: { id: configId, userId },
        data: { passingGrade },
      }),
    ]);

    return (await this.findById(userId, configId))!;
  },
};
