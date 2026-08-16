import { describe, expect, it } from 'vitest';
import {
  defaultSemesterDates,
  defaultSemesterName,
  getCurrentSemesterKey,
  isCurrentSemester,
  nextSemesterKey,
} from './semester-period.js';

/**
 * Testes da regra de identidade de semestre.
 *
 * As bordas sao as datas de virada: 31/12 -> 01/01 (troca de ano, mesmo
 * periodo) e 30/06 -> 01/07 (troca de periodo, mesmo ano).
 */

describe('getCurrentSemesterKey', () => {
  it('31 de dezembro ainda e o 2o periodo do ano', () => {
    expect(getCurrentSemesterKey(new Date(2026, 11, 31))).toEqual({ year: 2026, term: 2 });
  });

  it('1o de janeiro vira o 1o periodo do ano novo', () => {
    expect(getCurrentSemesterKey(new Date(2027, 0, 1))).toEqual({ year: 2027, term: 1 });
  });

  it('30 de junho ainda e o 1o periodo', () => {
    expect(getCurrentSemesterKey(new Date(2026, 5, 30))).toEqual({ year: 2026, term: 1 });
  });

  it('1o de julho vira o 2o periodo', () => {
    expect(getCurrentSemesterKey(new Date(2026, 6, 1))).toEqual({ year: 2026, term: 2 });
  });
});

describe('defaultSemesterName', () => {
  it('formata ano.periodo', () => {
    expect(defaultSemesterName({ year: 2026, term: 1 })).toBe('2026.1');
    expect(defaultSemesterName({ year: 2026, term: 2 })).toBe('2026.2');
  });
});

describe('defaultSemesterDates', () => {
  it('periodo 1 vai de fevereiro a 15 de julho', () => {
    const { startDate, endDate } = defaultSemesterDates({ year: 2026, term: 1 });

    expect(startDate).toEqual(new Date(2026, 1, 1));
    expect(endDate).toEqual(new Date(2026, 6, 15));
  });

  it('periodo 2 vai de 16 de julho a dezembro', () => {
    const { startDate, endDate } = defaultSemesterDates({ year: 2026, term: 2 });

    expect(startDate).toEqual(new Date(2026, 6, 16));
    expect(endDate).toEqual(new Date(2026, 11, 20));
  });
});

describe('isCurrentSemester', () => {
  const agora = new Date(2026, 7, 10);

  it('bate quando ano e periodo coincidem com o calculado agora', () => {
    expect(isCurrentSemester({ year: 2026, term: 2 }, agora)).toBe(true);
  });

  it('nao bate com outro periodo do mesmo ano', () => {
    expect(isCurrentSemester({ year: 2026, term: 1 }, agora)).toBe(false);
  });

  it('nao bate com outro ano', () => {
    expect(isCurrentSemester({ year: 2025, term: 2 }, agora)).toBe(false);
  });
});

describe('nextSemesterKey', () => {
  it('avanca do 1o para o 2o periodo do mesmo ano', () => {
    expect(nextSemesterKey({ year: 2026, term: 1 })).toEqual({ year: 2026, term: 2 });
  });

  it('avanca do 2o periodo para o 1o do ano seguinte', () => {
    expect(nextSemesterKey({ year: 2026, term: 2 })).toEqual({ year: 2027, term: 1 });
  });
});
