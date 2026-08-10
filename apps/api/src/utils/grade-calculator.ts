/**
 * Calculo de medias academicas.
 *
 * Extraido do dashboard quando a tela de disciplinas passou a precisar da
 * mesma conta: manter a regra em dois lugares garantiria divergencia entre o
 * numero do card e o numero da tela de detalhes.
 */

/** Nota no formato minimo necessario para o calculo. */
export interface GradeLike {
  value: number;
  maxValue: number;
  weight: number;
}

/** Nota como vem do banco: o peso mora no componente vinculado, nao na nota. */
export interface GradeRowLike {
  value: number;
  maxValue: number;
  gradeComponent: { id: string; weight: number };
}

/**
 * Achata as notas para o formato do calculo, AGRUPANDO por componente.
 *
 * Um componente pode receber varios lancamentos - e o que a nota parcial
 * ("ainda nao e a nota final") existe para permitir: o professor solta 2
 * pontos de trabalho hoje e 3 de prova depois, ambos no N2. Os valores somam
 * (normalizados na escala 0-10), mas o PESO do componente entra uma vez so.
 *
 * Sem o agrupamento, dois lancamentos no N2 de peso 4 contariam peso 8, e o
 * N2 passaria a valer o dobro do que a configuracao diz.
 */
export function toGradeLikes(rows: GradeRowLike[]): GradeLike[] {
  const byComponent = new Map<string, GradeLike>();

  for (const row of rows) {
    const maxValue = row.maxValue > 0 ? row.maxValue : 10;
    const normalized = (row.value / maxValue) * 10;
    const existing = byComponent.get(row.gradeComponent.id);

    if (existing) {
      existing.value += normalized;
      continue;
    }

    byComponent.set(row.gradeComponent.id, {
      // Ja normalizado para 0-10, entao a escala aqui e sempre 10.
      value: normalized,
      maxValue: 10,
      weight: row.gradeComponent.weight,
    });
  }

  return [...byComponent.values()];
}

/** Soma o peso de todos os componentes configurados, lancados ou nao. */
export function totalConfiguredWeight(
  components: { weight: number }[] | undefined,
): number | undefined {
  if (!components) return undefined;

  return components.reduce((total, component) => total + component.weight, 0);
}

/**
 * Media ponderada de uma lista de notas, na escala 0-10.
 *
 * As notas sao normalizadas antes da ponderacao: uma prova valendo 100 pontos
 * precisa ser comparavel a um trabalho valendo 10.
 *
 * `totalWeight`, quando informado, e o peso de TODOS os componentes
 * configurados (lancados ou nao) - a media entao conta o que falta como peso
 * no denominador, sem inventar nota para ele. Uma prova futura sem nota nao
 * pode "fechar" a media como se valesse zero; seu peso so entra na conta
 * quando alguem efetivamente lanca uma nota nela. Sem esse parametro (ou
 * quando ele vem menor que o peso ja lancado - nao deveria acontecer, mas nao
 * confiamos cegamente), o denominador cai para o peso das notas lancadas, o
 * comportamento historico.
 *
 * Retorna null quando nao ha nota - disciplina sem avaliacao nao e disciplina
 * com media zero, e exibir 0,0 sugeriria reprovacao.
 */
export function calculateWeightedAverage(grades: GradeLike[], totalWeight?: number): number | null {
  if (grades.length === 0) return null;

  let weightedSum = 0;
  let gradedWeight = 0;

  for (const grade of grades) {
    // Valores invalidos vindos de importacao usam o padrao em vez de zerar a conta.
    const maxValue = grade.maxValue > 0 ? grade.maxValue : 10;
    const weight = grade.weight > 0 ? grade.weight : 1;

    weightedSum += (grade.value / maxValue) * 10 * weight;
    gradedWeight += weight;
  }

  const denominator =
    totalWeight !== undefined ? Math.max(totalWeight, gradedWeight) : gradedWeight;

  if (denominator === 0) return null;

  return roundGrade(weightedSum / denominator);
}

/**
 * Media geral: media SIMPLES das medias por disciplina.
 *
 * Deliberadamente nao ponderada pela quantidade de avaliacoes - do contrario
 * uma disciplina com dez listas dominaria outra com duas provas.
 * Disciplinas sem nota ficam de fora.
 */
export function calculateOverallAverage(subjectAverages: (number | null)[]): number | null {
  const valid = subjectAverages.filter((average): average is number => average !== null);

  if (valid.length === 0) return null;

  const sum = valid.reduce((total, average) => total + average, 0);

  return roundGrade(sum / valid.length);
}

/**
 * Nota ainda necessaria para atingir a media de aprovacao.
 *
 * Considera o peso restante informado: com peso total 10, ja avaliados 6 e
 * media 5, faltam 4 pontos de peso para alcancar a media minima.
 *
 * Retorna:
 * - `null` quando nao ha peso restante (nada mais a fazer);
 * - valor <= 0 quando a aprovacao ja esta garantida;
 * - valor > escala maxima quando a aprovacao ja e impossivel.
 */
export function calculateRequiredGrade(
  currentGrades: GradeLike[],
  passingGrade: number,
  remainingWeight: number,
): number | null {
  if (remainingWeight <= 0) return null;

  let weightedSum = 0;
  let usedWeight = 0;

  for (const grade of currentGrades) {
    const maxValue = grade.maxValue > 0 ? grade.maxValue : 10;
    const weight = grade.weight > 0 ? grade.weight : 1;

    weightedSum += (grade.value / maxValue) * 10 * weight;
    usedWeight += weight;
  }

  const totalWeight = usedWeight + remainingWeight;
  const required = (passingGrade * totalWeight - weightedSum) / remainingWeight;

  return roundGrade(required);
}

/** Duas casas decimais: precisao suficiente para nota, sem ruido de ponto flutuante. */
export function roundGrade(value: number): number {
  return Number(value.toFixed(2));
}
