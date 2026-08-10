/**
 * Calculo de medias, no cliente.
 *
 * Espelha `apps/api/src/utils/grade-calculator.ts` - a Simulacao (Etapa 17)
 * roda inteiramente no navegador, sem chamar a API, entao precisa da mesma
 * algebra localmente. Mudar uma formula exige mudar as duas.
 */

export interface GradeLike {
  value: number;
  maxValue: number;
  weight: number;
}

export function roundGrade(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * `totalWeight`, quando informado, e o peso de TODOS os componentes
 * configurados (lancados ou nao) - ver a explicacao completa no espelho
 * backend, `apps/api/src/utils/grade-calculator.ts`.
 */
export function calculateWeightedAverage(grades: GradeLike[], totalWeight?: number): number | null {
  if (grades.length === 0) return null;

  let weightedSum = 0;
  let gradedWeight = 0;

  for (const grade of grades) {
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
