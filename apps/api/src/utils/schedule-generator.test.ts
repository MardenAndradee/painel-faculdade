import { describe, expect, it } from 'vitest';
import {
  desiredBlocksFor,
  generateSchedule,
  scoreTarget,
  type AvailabilityWindow,
  type BusyInterval,
  type StudyTarget,
} from './schedule-generator.js';

/** Segunda-feira, 3 de agosto de 2026, 08:00. */
const NOW = new Date(2026, 7, 3, 8, 0, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const OPTIONS = { days: 7, blockMinutes: 50, breakMinutes: 10, maxBlocksPerDay: 4 };

function target(overrides: Partial<StudyTarget> = {}): StudyTarget {
  return {
    id: 'alvo',
    kind: 'ASSIGNMENT',
    title: 'Tarefa',
    subjectId: 'disciplina-1',
    subjectName: 'Cálculo III',
    dueDate: new Date(NOW.getTime() + 3 * DAY),
    priority: 'MEDIUM',
    weight: null,
    desiredBlocks: 2,
    ...overrides,
  };
}

/** Todos os dias, das 14h às 18h. */
const EVERY_AFTERNOON: AvailabilityWindow[] = Array.from({ length: 7 }, (_, day) => ({
  dayOfWeek: day,
  startMinute: 14 * 60,
  endMinute: 18 * 60,
}));

describe('scoreTarget', () => {
  it('coloca o que vence antes na frente', () => {
    const tomorrow = target({ dueDate: new Date(NOW.getTime() + DAY) });
    const nextMonth = target({ dueDate: new Date(NOW.getTime() + 30 * DAY) });

    expect(scoreTarget(tomorrow, NOW)).toBeGreaterThan(scoreTarget(nextMonth, NOW));
  });

  it('faz uma entrega de amanhã ganhar de uma prova em duas semanas', () => {
    // Perder o prazo custa a nota inteira; a prova ainda tera outras chances
    // de estudo. E a razao de o prazo dominar o calculo.
    const delivery = target({ dueDate: new Date(NOW.getTime() + DAY) });
    const exam = target({
      kind: 'EXAM',
      dueDate: new Date(NOW.getTime() + 14 * DAY),
      priority: null,
      weight: 4,
    });

    expect(scoreTarget(delivery, NOW)).toBeGreaterThan(scoreTarget(exam, NOW));
  });

  it('desempata a favor da prova quando o prazo é o mesmo', () => {
    const exam = target({ kind: 'EXAM', priority: null, weight: null });
    const assignment = target({ priority: null });

    expect(scoreTarget(exam, NOW)).toBeGreaterThan(scoreTarget(assignment, NOW));
  });

  it('respeita a prioridade declarada', () => {
    expect(scoreTarget(target({ priority: 'URGENT' }), NOW)).toBeGreaterThan(
      scoreTarget(target({ priority: 'LOW' }), NOW),
    );
  });

  it('põe item sem prazo atrás de item com prazo distante', () => {
    expect(scoreTarget(target({ dueDate: null }), NOW)).toBeLessThan(
      scoreTarget(target({ dueDate: new Date(NOW.getTime() + 30 * DAY) }), NOW),
    );
  });
});

describe('generateSchedule', () => {
  it('não agenda nada sem disponibilidade, e explica o motivo', () => {
    const result = generateSchedule([target()], [], [], OPTIONS, NOW);

    expect(result.blocks).toHaveLength(0);
    expect(result.unscheduled[0]?.reason).toContain('disponibilidade');
  });

  it('encaixa os blocos na janela declarada', () => {
    const result = generateSchedule(
      [target({ desiredBlocks: 2 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.unscheduled).toHaveLength(0);
    expect(result.blocks[0]?.start.getHours()).toBe(14);
  });

  it('respeita a duração e o intervalo configurados', () => {
    const result = generateSchedule(
      [target({ desiredBlocks: 2 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );
    const [first, second] = result.blocks;

    expect((first!.end.getTime() - first!.start.getTime()) / 60000).toBe(50);
    expect((second!.start.getTime() - first!.end.getTime()) / 60000).toBe(10);
  });

  it('carrega o vínculo de origem em cada bloco', () => {
    const result = generateSchedule(
      [target({ desiredBlocks: 1 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );

    expect(result.blocks[0]?.assignmentId).toBe('alvo');
    expect(result.blocks[0]?.subjectId).toBe('disciplina-1');
    expect(result.blocks[0]?.examId).toBeNull();
  });

  it('numera o título só quando há mais de um bloco', () => {
    const many = generateSchedule(
      [target({ desiredBlocks: 2 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );
    const single = generateSchedule(
      [target({ desiredBlocks: 1 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );

    expect(many.blocks[0]?.title).toContain('(1/2)');
    expect(single.blocks[0]?.title).not.toContain('(1/1)');
  });

  it('nunca agenda no passado', () => {
    const afternoon = new Date(2026, 7, 3, 16, 30, 0, 0);
    const result = generateSchedule(
      [target({ desiredBlocks: 1 })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      afternoon,
    );

    expect(result.blocks[0]!.start.getTime()).toBeGreaterThanOrEqual(afternoon.getTime());
  });

  it('nunca agenda depois do prazo', () => {
    // Estudar para uma prova no dia seguinte a ela nao ajuda ninguem.
    const deadline = new Date(2026, 7, 3, 16, 30);
    const result = generateSchedule(
      [target({ desiredBlocks: 4, dueDate: deadline })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );

    expect(result.blocks.every((block) => block.start < deadline)).toBe(true);
    expect(result.blocks).toHaveLength(3);
    expect(result.unscheduled[0]?.reason).toContain('3 de 4 blocos');
  });

  it('reporta item cujo prazo já passou', () => {
    const result = generateSchedule(
      [target({ dueDate: new Date(NOW.getTime() - 2 * DAY) })],
      EVERY_AFTERNOON,
      [],
      OPTIONS,
      NOW,
    );

    expect(result.blocks).toHaveLength(0);
    expect(result.unscheduled[0]?.reason).toContain('prazo já passou');
  });

  it('desvia de compromissos existentes em vez de sobrepô-los', () => {
    const busy: BusyInterval[] = [
      { start: new Date(2026, 7, 3, 14, 0), end: new Date(2026, 7, 3, 16, 0) },
    ];
    const result = generateSchedule(
      [target({ desiredBlocks: 1 })],
      EVERY_AFTERNOON,
      busy,
      OPTIONS,
      NOW,
    );

    expect(result.blocks[0]!.start.getTime()).toBeGreaterThanOrEqual(busy[0]!.end.getTime());
  });

  it('empurra para o dia seguinte quando o dia está todo ocupado', () => {
    const busy: BusyInterval[] = [
      { start: new Date(2026, 7, 3, 13, 0), end: new Date(2026, 7, 3, 19, 0) },
    ];
    const result = generateSchedule(
      [target({ desiredBlocks: 1 })],
      EVERY_AFTERNOON,
      busy,
      OPTIONS,
      NOW,
    );

    expect(result.blocks[0]!.start.getDate()).toBe(4);
  });

  it('respeita o teto diário de blocos', () => {
    const targets = Array.from({ length: 10 }, (_, i) =>
      target({
        id: `t${i}`,
        desiredBlocks: 2,
        dueDate: new Date(NOW.getTime() + 6 * DAY),
      }),
    );
    const result = generateSchedule(
      targets,
      EVERY_AFTERNOON,
      [],
      { ...OPTIONS, maxBlocksPerDay: 2 },
      NOW,
    );

    const perDay = new Map<number, number>();
    for (const block of result.blocks) {
      perDay.set(block.start.getDate(), (perDay.get(block.start.getDate()) ?? 0) + 1);
    }

    expect([...perDay.values()].every((count) => count <= 2)).toBe(true);
  });

  it('atende o mais urgente primeiro, independentemente da ordem de entrada', () => {
    const urgent = target({
      id: 'urgente',
      dueDate: new Date(NOW.getTime() + DAY),
      desiredBlocks: 1,
    });
    const relaxed = target({
      id: 'tranquilo',
      dueDate: new Date(NOW.getTime() + 20 * DAY),
      desiredBlocks: 1,
    });

    const result = generateSchedule([relaxed, urgent], EVERY_AFTERNOON, [], OPTIONS, NOW);

    expect(result.blocks[0]?.assignmentId).toBe('urgente');
  });

  it('não gera blocos sobrepostos entre si', () => {
    const targets = Array.from({ length: 6 }, (_, i) =>
      target({ id: `d${i}`, desiredBlocks: 3, dueDate: new Date(NOW.getTime() + 6 * DAY) }),
    );
    const result = generateSchedule(
      targets,
      EVERY_AFTERNOON,
      [],
      { ...OPTIONS, maxBlocksPerDay: 12 },
      NOW,
    );

    const overlapping = result.blocks.some((block, i) =>
      result.blocks.some(
        (other, j) => i !== j && block.start < other.end && other.start < block.end,
      ),
    );

    expect(overlapping).toBe(false);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('recusa janela menor que um bloco', () => {
    const tooShort: AvailabilityWindow[] = [
      { dayOfWeek: 1, startMinute: 14 * 60, endMinute: 14 * 60 + 30 },
    ];
    const result = generateSchedule([target({ desiredBlocks: 1 })], tooShort, [], OPTIONS, NOW);

    expect(result.blocks).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
  });

  it('devolve os blocos ordenados no tempo', () => {
    const targets = [target({ id: 'a' }), target({ id: 'b', kind: 'EXAM' })];
    const result = generateSchedule(targets, EVERY_AFTERNOON, [], OPTIONS, NOW);

    const times = result.blocks.map((block) => block.start.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('é determinístico', () => {
    const a = generateSchedule([target()], EVERY_AFTERNOON, [], OPTIONS, NOW);
    const b = generateSchedule([target()], EVERY_AFTERNOON, [], OPTIONS, NOW);

    expect(a.blocks).toEqual(b.blocks);
  });
});

describe('desiredBlocksFor', () => {
  it('pede mais blocos para prova que para atividade', () => {
    const soon = new Date(NOW.getTime() + 3 * DAY);

    expect(desiredBlocksFor('EXAM', soon, NOW)).toBeGreaterThan(
      desiredBlocksFor('ASSIGNMENT', soon, NOW),
    );
  });

  it('pede só um bloco de aquecimento para prova muito distante', () => {
    expect(desiredBlocksFor('EXAM', new Date(NOW.getTime() + 40 * DAY), NOW)).toBe(1);
  });

  it('pede um bloco para item sem prazo', () => {
    expect(desiredBlocksFor('ASSIGNMENT', null, NOW)).toBe(1);
  });
});
