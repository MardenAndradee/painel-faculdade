import type { GradeTemplateChange } from '@painel/shared';

/**
 * Fusao do modelo de notas de um semestre com a configuracao de uma disciplina
 * (Etapa 18).
 *
 * Funcao pura, sem banco: o service so decide QUANDO aplicar. Isso deixa a
 * regra - qual e a diferenca e o que a fusao produz - testavel sem subir
 * Postgres, e e a mesma logica que alimenta a previa e a gravacao. Se fossem
 * duas implementacoes, a previa acabaria mentindo sobre o que seria gravado.
 *
 * A fusao e sempre ADITIVA:
 *
 * - componente do modelo ausente na disciplina -> criado;
 * - componente presente nos dois -> peso e ordem sincronizados com o modelo;
 * - componente que so a disciplina tem -> preservado, nunca removido.
 *
 * Remover continua sendo decisao manual, na configuracao da propria
 * disciplina, onde o aviso de "ja tem nota lancada" existe. Um modelo nunca
 * apaga nota de ninguem.
 */

export interface TemplateComponent {
  name: string;
  weight: number;
}

export interface SubjectComponent {
  id: string;
  name: string;
  weight: number;
  /** Ja tem nota lancada - mudar o peso aqui recalcula a media exibida. */
  hasGrade: boolean;
}

export interface GradeConfigurationShape<TComponent> {
  passingGrade: number;
  components: TComponent[];
}

/** Componente no formato que `gradeConfigurationRepository.replace` consome. */
export interface MergedComponent {
  /** Presente = atualiza o componente existente; ausente = cria um novo. */
  id?: string;
  name: string;
  weight: number;
}

/**
 * Componentes sao casados por NOME, nao por id: cada disciplina tem sua
 * propria copia, com ids diferentes. Ignora diferenca de caixa e espacos nas
 * pontas para que "n1 " e "N1" nao virem dois componentes.
 */
function matchKey(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR');
}

/** Casa cada componente do modelo com o da disciplina, sem reaproveitar o mesmo dois vezes. */
function pairUp(
  template: TemplateComponent[],
  subject: SubjectComponent[],
): {
  pairs: Array<{ template: TemplateComponent; subject: SubjectComponent | null }>;
  unmatchedSubject: SubjectComponent[];
} {
  const available = new Map<string, SubjectComponent[]>();

  for (const component of subject) {
    const key = matchKey(component.name);

    available.set(key, [...(available.get(key) ?? []), component]);
  }

  const used = new Set<string>();
  const pairs = template.map((component) => {
    // `shift` garante que dois componentes homonimos no modelo nao casem com
    // o mesmo componente da disciplina.
    const match = available.get(matchKey(component.name))?.shift() ?? null;

    if (match) used.add(match.id);

    return { template: component, subject: match };
  });

  return { pairs, unmatchedSubject: subject.filter((component) => !used.has(component.id)) };
}

/** Pesos iguais a menos de ruido de ponto flutuante (0,5 + 0,25 nao e exatamente 0,75). */
function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

/**
 * O que mudaria na disciplina se o modelo fosse aplicado.
 *
 * Lista vazia = disciplina ja alinhada, nada a propagar. A ordem dos
 * componentes nao entra na diferenca: e consequencia da fusao, nao uma
 * decisao que valha confirmar.
 */
export function diffTemplateAgainstSubject(
  template: GradeConfigurationShape<TemplateComponent>,
  subject: GradeConfigurationShape<SubjectComponent>,
): GradeTemplateChange[] {
  const changes: GradeTemplateChange[] = [];
  const { pairs } = pairUp(template.components, subject.components);

  for (const pair of pairs) {
    if (!pair.subject) {
      changes.push({
        kind: 'ADD_COMPONENT',
        componentName: pair.template.name,
        from: null,
        to: pair.template.weight,
        affectsGrades: false,
      });

      continue;
    }

    if (!sameNumber(pair.subject.weight, pair.template.weight)) {
      changes.push({
        kind: 'UPDATE_WEIGHT',
        componentName: pair.subject.name,
        from: pair.subject.weight,
        to: pair.template.weight,
        affectsGrades: pair.subject.hasGrade,
      });
    }
  }

  if (!sameNumber(subject.passingGrade, template.passingGrade)) {
    changes.push({
      kind: 'UPDATE_PASSING_GRADE',
      componentName: null,
      from: subject.passingGrade,
      to: template.passingGrade,
      // Mexe no criterio de aprovacao, nao nas notas em si.
      affectsGrades: false,
    });
  }

  return changes;
}

/**
 * Configuracao resultante da fusao.
 *
 * Os componentes do modelo vem primeiro, na ordem do modelo, para que a
 * disciplina passe a se ler como ele; os exclusivos da disciplina seguem
 * depois, na ordem em que ja estavam. Quem grava atribui `order` pelo indice.
 */
export function mergeTemplateIntoSubject(
  template: GradeConfigurationShape<TemplateComponent>,
  subject: GradeConfigurationShape<SubjectComponent>,
): GradeConfigurationShape<MergedComponent> {
  const { pairs, unmatchedSubject } = pairUp(template.components, subject.components);

  const components: MergedComponent[] = [
    ...pairs.map((pair) =>
      pair.subject
        ? // Mantem o nome como o modelo escreve, agora que os dois sao "o mesmo".
          { id: pair.subject.id, name: pair.template.name, weight: pair.template.weight }
        : { name: pair.template.name, weight: pair.template.weight },
    ),
    ...unmatchedSubject.map((component) => ({
      id: component.id,
      name: component.name,
      weight: component.weight,
    })),
  ];

  return { passingGrade: template.passingGrade, components };
}
