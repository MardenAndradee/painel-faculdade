import { describe, expect, it } from 'vitest';
import {
  calculateOverallAverage,
  calculateRequiredGrade,
  calculateWeightedAverage,
  roundGrade,
} from './grade-calculator.js';

describe('calculateWeightedAverage', () => {
  it('devolve nulo sem notas', () => {
    expect(calculateWeightedAverage([])).toBeNull();
  });

  it('calcula a média simples quando todos os pesos são iguais', () => {
    const grades = [
      { value: 8, maxValue: 10, weight: 1 },
      { value: 6, maxValue: 10, weight: 1 },
    ];

    expect(calculateWeightedAverage(grades)).toBe(7);
  });

  it('pondera pelos pesos informados', () => {
    // (8x3 + 4x1) / 4 = 7
    const grades = [
      { value: 8, maxValue: 10, weight: 3 },
      { value: 4, maxValue: 10, weight: 1 },
    ];

    expect(calculateWeightedAverage(grades)).toBe(7);
  });

  it('normaliza escalas diferentes para 0–10 antes de ponderar', () => {
    // Uma prova de 100 pontos e um trabalho de 10 precisam ser comparaveis:
    // 80/100 vale o mesmo que 8/10.
    const grades = [
      { value: 80, maxValue: 100, weight: 1 },
      { value: 8, maxValue: 10, weight: 1 },
    ];

    expect(calculateWeightedAverage(grades)).toBe(8);
  });

  it('usa o padrão quando a escala vem inválida de uma importação', () => {
    // Dados do Classroom podem chegar com maxValue zerado; zerar a conta
    // inteira por causa disso seria pior que assumir a escala padrao.
    expect(calculateWeightedAverage([{ value: 7, maxValue: 0, weight: 1 }])).toBe(7);
  });

  it('usa peso 1 quando o peso vem zerado', () => {
    expect(calculateWeightedAverage([{ value: 7, maxValue: 10, weight: 0 }])).toBe(7);
  });
});

describe('calculateOverallAverage', () => {
  it('devolve nulo quando nenhuma disciplina tem nota', () => {
    expect(calculateOverallAverage([null, null])).toBeNull();
  });

  it('ignora disciplinas sem nota', () => {
    expect(calculateOverallAverage([8, null, 6])).toBe(7);
  });

  it('NÃO pondera pela quantidade de avaliações', () => {
    // Deliberado: uma disciplina com dez listas nao pode dominar outra com
    // duas provas. A media geral e a media SIMPLES das medias.
    expect(calculateOverallAverage([10, 0])).toBe(5);
  });
});

describe('calculateRequiredGrade', () => {
  it('devolve nulo quando não resta peso a avaliar', () => {
    // Sem provas pendentes cadastradas nao ha o que projetar; inventar um
    // numero aqui daria falsa esperanca ao aluno.
    expect(calculateRequiredGrade([{ value: 5, maxValue: 10, weight: 2 }], 6, 0)).toBeNull();
  });

  it('calcula a nota necessária a partir do peso restante', () => {
    // (6 x 10 - 10) / 8 = 6,25
    const required = calculateRequiredGrade([{ value: 5, maxValue: 10, weight: 2 }], 6, 8);

    expect(required).toBe(6.25);
  });

  it('devolve valor não positivo quando a aprovação já está garantida', () => {
    const required = calculateRequiredGrade([{ value: 10, maxValue: 10, weight: 9 }], 6, 1);

    expect(required).toBeLessThanOrEqual(0);
  });

  it('devolve valor acima da escala quando a aprovação é impossível', () => {
    const required = calculateRequiredGrade([{ value: 0, maxValue: 10, weight: 9 }], 6, 1);

    expect(required).toBeGreaterThan(10);
  });
});

describe('roundGrade', () => {
  it('arredonda para duas casas', () => {
    expect(roundGrade(7.126)).toBe(7.13);
  });

  it('elimina o ruído de ponto flutuante', () => {
    expect(roundGrade(0.1 + 0.2)).toBe(0.3);
  });
});
