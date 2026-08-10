import { describe, expect, it } from 'vitest';
import {
  calculateOverallAverage,
  calculateRequiredGrade,
  calculateWeightedAverage,
  roundGrade,
  toGradeLikes,
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

  describe('com totalWeight (componente pendente nao pode contar como zero)', () => {
    it('usa o peso total configurado no denominador, nao so o das notas lançadas', () => {
      // Caso real: N1 peso3 nota7, N2 peso4 nota6, N3 peso3 ainda sem nota.
      // (7x3 + 6x4) / 10 = 4,5 - o peso de N3 entra no denominador mesmo sem
      // nota lancada, mas sem contribuir nada no numerador.
      const grades = [
        { value: 7, maxValue: 10, weight: 3 },
        { value: 6, maxValue: 10, weight: 4 },
      ];

      expect(calculateWeightedAverage(grades, 10)).toBe(4.5);
    });

    it('ignora totalWeight menor que o peso já lançado', () => {
      // Nao deveria acontecer (peso configurado sempre >= peso lancado), mas
      // um totalWeight incoerente nao pode inflar a media dividindo por menos
      // do que o peso real das notas.
      const grades = [{ value: 8, maxValue: 10, weight: 5 }];

      expect(calculateWeightedAverage(grades, 2)).toBe(calculateWeightedAverage(grades));
    });

    it('sem notas lançadas continua nulo mesmo com totalWeight', () => {
      expect(calculateWeightedAverage([], 10)).toBeNull();
    });
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

describe('toGradeLikes', () => {
  /**
   * O peso mora no componente, e um componente pode receber varios
   * lancamentos - e o que a nota parcial ("ainda nao e a nota final")
   * permite. Somar os valores sem agrupar contaria o peso duas vezes.
   */

  it('achata o peso do componente', () => {
    const likes = toGradeLikes([
      { value: 8, maxValue: 10, gradeComponent: { id: 'n1', weight: 3 } },
    ]);

    expect(likes).toEqual([{ value: 8, maxValue: 10, weight: 3 }]);
  });

  it('soma vários lançamentos do mesmo componente sem duplicar o peso', () => {
    // N2 de peso 4 recebeu 2 pontos de trabalho e 3 de prova: vale 5, peso 4.
    const likes = toGradeLikes([
      { value: 2, maxValue: 10, gradeComponent: { id: 'n2', weight: 4 } },
      { value: 3, maxValue: 10, gradeComponent: { id: 'n2', weight: 4 } },
    ]);

    expect(likes).toEqual([{ value: 5, maxValue: 10, weight: 4 }]);
  });

  it('normaliza escalas diferentes antes de somar', () => {
    // 50/100 e 5/10 sao a mesma coisa: o componente fica com 10 de 10.
    const likes = toGradeLikes([
      { value: 50, maxValue: 100, gradeComponent: { id: 'n1', weight: 2 } },
      { value: 5, maxValue: 10, gradeComponent: { id: 'n1', weight: 2 } },
    ]);

    expect(likes).toEqual([{ value: 10, maxValue: 10, weight: 2 }]);
  });

  it('mantém componentes distintos separados', () => {
    const likes = toGradeLikes([
      { value: 5, maxValue: 10, gradeComponent: { id: 'n1', weight: 3 } },
      { value: 5, maxValue: 10, gradeComponent: { id: 'n2', weight: 4 } },
    ]);

    expect(likes).toHaveLength(2);
    expect(likes.reduce((total, like) => total + like.weight, 0)).toBe(7);
  });
});

describe('nota parcial conta na projeção (bug relatado)', () => {
  /**
   * Caso exato do relato: N1 (peso 3) com 5 e N2 (peso 4) com 5 marcada como
   * "ainda nao e a nota final", N3 (peso 3) sem nota. O calculo antigo
   * descartava a N2 inteira e pedia 6,4 "na N2 e N3", ignorando 20 pontos ja
   * garantidos. Faltam 8,33 na N3.
   */
  const lancadas = toGradeLikes([
    { value: 5, maxValue: 10, gradeComponent: { id: 'n1', weight: 3 } },
    { value: 5, maxValue: 10, gradeComponent: { id: 'n2', weight: 4 } },
  ]);

  it('pede a nota certa apenas no que falta', () => {
    expect(calculateRequiredGrade(lancadas, 6, 3)).toBe(8.33);
  });

  it('a média já reflete os pontos da nota parcial', () => {
    expect(calculateWeightedAverage(lancadas, 10)).toBe(3.5);
  });
});
