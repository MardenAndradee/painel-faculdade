import { describe, expect, it } from 'vitest';
import {
  toAssignmentFields,
  toEventFields,
  toExamFields,
  type ClassPostFields,
} from './class-post-fields.js';

const BASE: ClassPostFields = {
  title: 'Prova N1',
  description: 'Conteúdo até o capítulo 5',
  date: new Date('2026-09-10T14:00:00'),
  durationMinutes: 90,
  room: 'Sala 4',
  dueDate: new Date('2026-09-08T23:59:00'),
  priority: 'HIGH',
  maxPoints: 10,
  startsAt: new Date('2026-09-10T14:00:00'),
  endsAt: new Date('2026-09-10T16:00:00'),
  allDay: false,
};

describe('toAssignmentFields', () => {
  it('mapeia título, descrição, prazo, prioridade e pontuação', () => {
    expect(toAssignmentFields(BASE)).toEqual({
      title: 'Prova N1',
      description: 'Conteúdo até o capítulo 5',
      dueDate: BASE.dueDate,
      priority: 'HIGH',
      maxPoints: 10,
    });
  });

  it('usa MEDIUM quando o post não define prioridade', () => {
    const result = toAssignmentFields({ ...BASE, priority: null });

    expect(result.priority).toBe('MEDIUM');
  });

  it('preserva description e dueDate nulos', () => {
    const result = toAssignmentFields({ ...BASE, description: null, dueDate: null });

    expect(result.description).toBeNull();
    expect(result.dueDate).toBeNull();
  });
});

describe('toExamFields', () => {
  it('mapeia description do post para content da prova', () => {
    expect(toExamFields(BASE)).toEqual({
      title: 'Prova N1',
      content: 'Conteúdo até o capítulo 5',
      date: BASE.date,
      durationMinutes: 90,
      room: 'Sala 4',
    });
  });

  it('lança quando o post não tem data (violação de invariante do schema)', () => {
    expect(() => toExamFields({ ...BASE, date: null })).toThrow();
  });
});

describe('toEventFields', () => {
  it('mapeia título, descrição e intervalo', () => {
    expect(toEventFields(BASE)).toEqual({
      title: 'Prova N1',
      description: 'Conteúdo até o capítulo 5',
      startsAt: BASE.startsAt,
      endsAt: BASE.endsAt,
      allDay: false,
    });
  });

  it('usa false quando o post não define allDay', () => {
    const result = toEventFields({ ...BASE, allDay: null });

    expect(result.allDay).toBe(false);
  });

  it('lança quando falta startsAt ou endsAt', () => {
    expect(() => toEventFields({ ...BASE, startsAt: null })).toThrow();
    expect(() => toEventFields({ ...BASE, endsAt: null })).toThrow();
  });
});
