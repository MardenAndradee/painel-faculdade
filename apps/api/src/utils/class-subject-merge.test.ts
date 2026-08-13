import { describe, expect, it } from 'vitest';
import { matchClassSubjects } from './class-subject-merge.js';

describe('matchClassSubjects', () => {
  it('vincula quando o nome é idêntico', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: 'Redes de Computadores' }],
      [{ id: 's1', name: 'Redes de Computadores', archivedAt: null }],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'link', subjectId: 's1' }]);
  });

  it('ignora acentos e caixa ao casar', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: 'Cálculo III' }],
      [{ id: 's1', name: 'calculo iii', archivedAt: null }],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'link', subjectId: 's1' }]);
  });

  it('ignora espaços nas pontas', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: '  Física I  ' }],
      [{ id: 's1', name: 'Física I', archivedAt: null }],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'link', subjectId: 's1' }]);
  });

  it('cria quando não há disciplina correspondente', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: 'Estrutura de Dados' }],
      [{ id: 's1', name: 'Redes de Computadores', archivedAt: null }],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'create' }]);
  });

  it('nunca reaproveita uma disciplina arquivada', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: 'Redes de Computadores' }],
      [{ id: 's1', name: 'Redes de Computadores', archivedAt: new Date('2026-01-01') }],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'create' }]);
  });

  it('duplicata: a primeira disciplina ativa encontrada vence', () => {
    const result = matchClassSubjects(
      [{ id: 'cs1', name: 'Cálculo III' }],
      [
        { id: 's1', name: 'Cálculo III', archivedAt: null },
        { id: 's2', name: 'cálculo iii', archivedAt: null },
      ],
    );

    expect(result).toEqual([{ classSubjectId: 'cs1', action: 'link', subjectId: 's1' }]);
  });

  it('duas ClassSubject homônimas podem casar com a mesma Subject (sem consumo)', () => {
    const result = matchClassSubjects(
      [
        { id: 'cs1', name: 'Redes de Computadores' },
        { id: 'cs2', name: 'Redes de Computadores' },
      ],
      [{ id: 's1', name: 'Redes de Computadores', archivedAt: null }],
    );

    expect(result).toEqual([
      { classSubjectId: 'cs1', action: 'link', subjectId: 's1' },
      { classSubjectId: 'cs2', action: 'link', subjectId: 's1' },
    ]);
  });

  it('lista vazia de disciplinas existentes cria tudo', () => {
    const result = matchClassSubjects(
      [
        { id: 'cs1', name: 'Álgebra Linear' },
        { id: 'cs2', name: 'Programação I' },
      ],
      [],
    );

    expect(result).toEqual([
      { classSubjectId: 'cs1', action: 'create' },
      { classSubjectId: 'cs2', action: 'create' },
    ]);
  });
});
