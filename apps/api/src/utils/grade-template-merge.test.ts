import { describe, expect, it } from 'vitest';
import {
  diffTemplateAgainstSubject,
  mergeTemplateIntoSubject,
  type SubjectComponent,
  type TemplateComponent,
} from './grade-template-merge.js';

/**
 * Testes da fusao do modelo de semestre com a configuracao de uma disciplina.
 *
 * A garantia que mais importa aqui e negativa: propagar um modelo NUNCA pode
 * fazer sumir um componente que so a disciplina tem - seria apagar nota
 * lancada como efeito colateral de mexer num modelo.
 */

function template(
  components: TemplateComponent[],
  passingGrade = 6,
): { passingGrade: number; components: TemplateComponent[] } {
  return { passingGrade, components };
}

function subject(
  components: Array<Partial<SubjectComponent> & { name: string; weight: number }>,
  passingGrade = 6,
): { passingGrade: number; components: SubjectComponent[] } {
  return {
    passingGrade,
    components: components.map((component, index) => ({
      id: component.id ?? `c${index}`,
      name: component.name,
      weight: component.weight,
      hasGrade: component.hasGrade ?? false,
    })),
  };
}

describe('diferenca entre modelo e disciplina', () => {
  it('não acusa diferença quando já estão iguais', () => {
    const changes = diffTemplateAgainstSubject(
      template([
        { name: 'N1', weight: 3 },
        { name: 'N2', weight: 4 },
      ]),
      subject([
        { name: 'N1', weight: 3 },
        { name: 'N2', weight: 4 },
      ]),
    );

    expect(changes).toEqual([]);
  });

  it('aponta componente que o modelo tem e a disciplina não', () => {
    const changes = diffTemplateAgainstSubject(
      template([
        { name: 'N1', weight: 3 },
        { name: 'N3', weight: 3 },
      ]),
      subject([{ name: 'N1', weight: 3 }]),
    );

    expect(changes).toEqual([
      { kind: 'ADD_COMPONENT', componentName: 'N3', from: null, to: 3, affectsGrades: false },
    ]);
  });

  it('avisa quando mudar o peso mexe em nota já lançada', () => {
    // Este e o aviso que a tela destaca: recalcula uma media que a pessoa ja viu.
    const changes = diffTemplateAgainstSubject(
      template([{ name: 'N1', weight: 4 }]),
      subject([{ name: 'N1', weight: 3, hasGrade: true }]),
    );

    expect(changes).toEqual([
      { kind: 'UPDATE_WEIGHT', componentName: 'N1', from: 3, to: 4, affectsGrades: true },
    ]);
  });

  it('reporta a nota de aprovação divergente', () => {
    const changes = diffTemplateAgainstSubject(template([], 7), subject([], 6));

    expect(changes).toEqual([
      { kind: 'UPDATE_PASSING_GRADE', componentName: null, from: 6, to: 7, affectsGrades: false },
    ]);
  });

  it('ignora diferença de caixa e espaços no nome', () => {
    // Sem isso, "n1 " e "N1" viravam dois componentes e a media dobrava o peso.
    const changes = diffTemplateAgainstSubject(
      template([{ name: 'N1', weight: 3 }]),
      subject([{ name: ' n1 ', weight: 3 }]),
    );

    expect(changes).toEqual([]);
  });

  it('não acusa diferença por ruído de ponto flutuante', () => {
    const changes = diffTemplateAgainstSubject(
      template([{ name: 'N1', weight: 0.5 + 0.25 }]),
      subject([{ name: 'N1', weight: 0.75 }]),
    );

    expect(changes).toEqual([]);
  });

  it('não reporta componente que só a disciplina tem', () => {
    // A fusao nunca remove; nao ha o que confirmar.
    const changes = diffTemplateAgainstSubject(
      template([{ name: 'N1', weight: 3 }]),
      subject([
        { name: 'N1', weight: 3 },
        { name: 'Substitutiva', weight: 2 },
      ]),
    );

    expect(changes).toEqual([]);
  });
});

describe('fusão do modelo na disciplina', () => {
  it('preserva o componente que só a disciplina tem', () => {
    // A garantia central da Etapa 18: propagar nunca apaga.
    const merged = mergeTemplateIntoSubject(
      template([{ name: 'N1', weight: 3 }]),
      subject([
        { id: 'a', name: 'N1', weight: 1 },
        { id: 'b', name: 'Substitutiva', weight: 2, hasGrade: true },
      ]),
    );

    expect(merged.components).toEqual([
      { id: 'a', name: 'N1', weight: 3 },
      { id: 'b', name: 'Substitutiva', weight: 2 },
    ]);
  });

  it('reaproveita o id do componente existente em vez de recriar', () => {
    // Recriar apagaria a nota vinculada por cascata.
    const merged = mergeTemplateIntoSubject(
      template([{ name: 'N1', weight: 4 }]),
      subject([{ id: 'existente', name: 'N1', weight: 3, hasGrade: true }]),
    );

    expect(merged.components).toEqual([{ id: 'existente', name: 'N1', weight: 4 }]);
  });

  it('cria sem id o componente que ainda não existe', () => {
    const merged = mergeTemplateIntoSubject(
      template([
        { name: 'N1', weight: 3 },
        { name: 'N2', weight: 4 },
      ]),
      subject([{ id: 'a', name: 'N1', weight: 3 }]),
    );

    expect(merged.components).toEqual([
      { id: 'a', name: 'N1', weight: 3 },
      { name: 'N2', weight: 4 },
    ]);
  });

  it('põe os componentes do modelo na frente, na ordem do modelo', () => {
    const merged = mergeTemplateIntoSubject(
      template([
        { name: 'N1', weight: 3 },
        { name: 'N2', weight: 4 },
      ]),
      subject([
        { id: 'x', name: 'Extra', weight: 1 },
        { id: 'b', name: 'N2', weight: 4 },
      ]),
    );

    expect(merged.components.map((component) => component.name)).toEqual(['N1', 'N2', 'Extra']);
  });

  it('adota a nota de aprovação do modelo', () => {
    const merged = mergeTemplateIntoSubject(template([], 7), subject([], 6));

    expect(merged.passingGrade).toBe(7);
  });

  it('não casa dois componentes homônimos do modelo com o mesmo da disciplina', () => {
    const merged = mergeTemplateIntoSubject(
      template([
        { name: 'N1', weight: 3 },
        { name: 'N1', weight: 5 },
      ]),
      subject([{ id: 'a', name: 'N1', weight: 1 }]),
    );

    expect(merged.components).toEqual([
      { id: 'a', name: 'N1', weight: 3 },
      { name: 'N1', weight: 5 },
    ]);
  });

  it('a diferença e a fusão contam a mesma história', () => {
    // A previa mostra o que a gravacao faz; divergirem seria mentir na
    // confirmacao. Depois de fundir, nao pode sobrar diferenca nenhuma.
    const model = template(
      [
        { name: 'N1', weight: 3 },
        { name: 'N2', weight: 4 },
        { name: 'N3', weight: 3 },
      ],
      7,
    );
    const current = subject(
      [
        { id: 'a', name: 'N1', weight: 1, hasGrade: true },
        { id: 'x', name: 'Extra', weight: 2 },
      ],
      6,
    );

    expect(diffTemplateAgainstSubject(model, current)).toHaveLength(4);

    const merged = mergeTemplateIntoSubject(model, current);

    const applied = {
      passingGrade: merged.passingGrade,
      components: merged.components.map((component, index) => ({
        id: component.id ?? `novo${index}`,
        name: component.name,
        weight: component.weight,
        hasGrade: false,
      })),
    };

    expect(diffTemplateAgainstSubject(model, applied)).toEqual([]);
  });
});
