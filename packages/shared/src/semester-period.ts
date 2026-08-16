/**
 * Regra pura de identidade de semestre (Etapa 31).
 *
 * Fonte unica do calculo "que semestre e hoje" e das datas/nome padrao de um
 * semestre novo - antes triplicado e divergente entre o seed, o formulario
 * manual (removido nesta etapa) e a resolucao de semestre de Turma.
 */

export interface SemesterKey {
  year: number;
  term: number;
}

/** Corte do calendario academico brasileiro: ate maio e o 1o semestre. */
export function getCurrentSemesterKey(now: Date): SemesterKey {
  return { year: now.getFullYear(), term: now.getMonth() < 6 ? 1 : 2 };
}

export function defaultSemesterName({ year, term }: SemesterKey): string {
  return `${year}.${term}`;
}

/**
 * Periodo 1: fevereiro a 15 de julho. Periodo 2: 16 de julho a dezembro.
 *
 * So um ponto de partida - o usuario pode ajustar depois. `endDate`/`startDate`
 * nao entram em nenhuma regra de negocio (ver docs/planning/semestre-automatico.md).
 */
export function defaultSemesterDates({ year, term }: SemesterKey): {
  startDate: Date;
  endDate: Date;
} {
  return term === 1
    ? { startDate: new Date(year, 1, 1), endDate: new Date(year, 6, 15) }
    : { startDate: new Date(year, 6, 16), endDate: new Date(year, 11, 20) };
}

/** Um semestre e "atual" quando seu (ano, periodo) bate com o calculado agora. */
export function isCurrentSemester(key: SemesterKey, now: Date): boolean {
  const current = getCurrentSemesterKey(now);

  return key.year === current.year && key.term === current.term;
}

/**
 * O semestre seguinte a um dado (ano, periodo): 1->2 no mesmo ano, 2->1 no
 * ano seguinte. Usado por "Finalizar semestre" (Turma, Etapa 30) para saber
 * pra onde avancar - nunca pula nem fica pra tras.
 */
export function nextSemesterKey({ year, term }: SemesterKey): SemesterKey {
  return term === 1 ? { year, term: 2 } : { year: year + 1, term: 1 };
}
