import type { Priority, StudyTargetKind } from '@painel/shared';

/**
 * Gerador de cronograma.
 *
 * Funcao pura: recebe as janelas livres, o trabalho pendente e a data de
 * referencia; devolve os blocos. Sem banco, sem `new Date()` implicito e sem
 * efeito colateral - o que permite testar o algoritmo isoladamente e mantem a
 * regra fora do repositorio.
 *
 * O problema em si e um escalonamento com prazos: distribuir N tarefas com
 * datas-limite dentro de M janelas de tempo. A solucao adotada e gulosa
 * (ordena por urgencia e preenche a primeira janela que serve), o que basta
 * aqui - um otimo global exigiria programacao inteira para ganhar quase nada
 * numa semana de estudo.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** Janela semanal recorrente em que o aluno consegue estudar. */
export interface AvailabilityWindow {
  /** 0 = domingo, 6 = sabado. */
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

/** Item que precisa de estudo. */
export interface StudyTarget {
  id: string;
  kind: StudyTargetKind;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  /** Prova ou entrega. Nulo significa sem prazo definido. */
  dueDate: Date | null;
  /** Prioridade declarada pelo item, quando existir. */
  priority: Priority | null;
  /** Peso da prova na media, quando aplicavel. */
  weight: number | null;
  /** Quantos blocos este item merece, calculado a partir da urgencia. */
  desiredBlocks: number;
}

export interface GeneratorOptions {
  days: number;
  blockMinutes: number;
  breakMinutes: number;
  maxBlocksPerDay: number;
}

/** Bloco proposto pelo gerador, ainda sem id. */
export interface PlannedBlock {
  title: string;
  start: Date;
  end: Date;
  subjectId: string | null;
  assignmentId: string | null;
  examId: string | null;
}

export interface GeneratorResult {
  blocks: PlannedBlock[];
  unscheduled: { kind: StudyTargetKind; title: string; reason: string }[];
}

/** Intervalo ja ocupado, que o gerador precisa desviar. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

// ---------------------------------------------------------------------------
// Priorizacao
// ---------------------------------------------------------------------------

const PRIORITY_BONUS: Record<Priority, number> = {
  URGENT: 25,
  HIGH: 15,
  MEDIUM: 5,
  LOW: 0,
};

/** Provas valem mais nota que atividades, entao entram na frente num empate. */
const KIND_BONUS: Record<StudyTargetKind, number> = {
  EXAM: 25,
  ASSIGNMENT: 10,
  SUBJECT: 0,
};

/**
 * Urgencia de um item, em pontos.
 *
 * A proximidade do prazo domina o calculo: entre uma prova daqui a duas
 * semanas e uma entrega de amanha, a entrega vem primeiro mesmo valendo menos
 * nota - perder o prazo custa a nota inteira. Os demais fatores so desempatam.
 */
export function scoreTarget(target: StudyTarget, now: Date): number {
  let score = KIND_BONUS[target.kind];

  if (target.priority) score += PRIORITY_BONUS[target.priority];

  // Peso da prova entra em escala pequena para nao competir com o prazo.
  if (target.weight !== null) score += Math.min(target.weight, 10);

  if (target.dueDate === null) {
    // Sem prazo, o item ainda merece estudo, mas nunca na frente do que vence.
    return score;
  }

  const daysLeft = (target.dueDate.getTime() - now.getTime()) / MS_PER_DAY;

  // Curva hiperbolica: 1 dia vale ~100, 7 dias ~25, 30 dias ~6. O decaimento
  // rapido e proposital - e o que faz "amanha" ganhar de "daqui a um mes".
  score += Math.round(200 / Math.max(daysLeft + 1, 1));

  return score;
}

// ---------------------------------------------------------------------------
// Encaixe nas janelas
// ---------------------------------------------------------------------------

/** Fatia livre num dia concreto, ja materializada em datas. */
interface FreeSlot {
  start: Date;
  end: Date;
}

function atMinute(day: Date, minute: number): Date {
  const result = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  result.setMinutes(minute);

  return result;
}

function overlaps(a: FreeSlot, b: BusyInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Materializa as janelas recorrentes nos proximos dias, ja descontando o que
 * esta ocupado e o que ficou no passado.
 */
function buildFreeSlots(
  windows: AvailabilityWindow[],
  busy: BusyInterval[],
  now: Date,
  days: number,
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(now.getTime() + offset * MS_PER_DAY);

    for (const window of windows.filter((item) => item.dayOfWeek === day.getDay())) {
      let start = atMinute(day, window.startMinute);
      const end = atMinute(day, window.endMinute);

      // Hoje, a janela comeca no maximo agora: nao se agenda para tras.
      if (start < now) start = new Date(Math.max(start.getTime(), now.getTime()));

      if (start >= end) continue;

      // Recorta os pedacos ocupados. Sem isso o cronograma marcaria estudo em
      // cima da propria aula ou de uma prova.
      let pieces: FreeSlot[] = [{ start, end }];

      for (const interval of busy) {
        const next: FreeSlot[] = [];

        for (const piece of pieces) {
          if (!overlaps(piece, interval)) {
            next.push(piece);
            continue;
          }

          if (piece.start < interval.start) next.push({ start: piece.start, end: interval.start });
          if (interval.end < piece.end) next.push({ start: interval.end, end: piece.end });
        }

        pieces = next;
      }

      slots.push(...pieces);
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MINUTE;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Titulo do bloco, legivel na agenda sem precisar abrir. */
function blockTitle(target: StudyTarget, index: number, total: number): string {
  const base =
    target.kind === 'EXAM'
      ? `Estudar para ${target.title}`
      : target.kind === 'ASSIGNMENT'
        ? `Trabalhar em ${target.title}`
        : `Revisar ${target.title}`;

  // A numeracao so aparece quando existe mais de um bloco: "(1/1)" seria ruido.
  return total > 1 ? `${base} (${index + 1}/${total})` : base;
}

/**
 * Gera os blocos.
 *
 * Estrategia: ordena os alvos por urgencia e, para cada um, tenta colocar seus
 * blocos nas primeiras fatias livres que couberem. Um alvo com prazo nunca
 * recebe bloco DEPOIS do proprio prazo - estudar para uma prova no dia
 * seguinte a ela nao ajuda ninguem.
 */
export function generateSchedule(
  targets: StudyTarget[],
  windows: AvailabilityWindow[],
  busy: BusyInterval[],
  options: GeneratorOptions,
  now: Date,
): GeneratorResult {
  const unscheduled: GeneratorResult['unscheduled'] = [];

  if (windows.length === 0) {
    return {
      blocks: [],
      unscheduled: targets.map((target) => ({
        kind: target.kind,
        title: target.title,
        reason: 'Nenhuma janela de disponibilidade cadastrada',
      })),
    };
  }

  const slots = buildFreeSlots(windows, busy, now, options.days);
  const blocks: PlannedBlock[] = [];
  const blocksPerDay = new Map<string, number>();

  /** Ponteiro de quanto de cada fatia ja foi consumido. */
  const cursors = slots.map((slot) => new Date(slot.start));

  const ordered = [...targets].sort((a, b) => scoreTarget(b, now) - scoreTarget(a, now));

  for (const target of ordered) {
    let placed = 0;

    for (let attempt = 0; attempt < target.desiredBlocks; attempt++) {
      const slotIndex = slots.findIndex((slot, index) => {
        const cursor = cursors[index] as Date;

        if (minutesBetween(cursor, slot.end) < options.blockMinutes) return false;

        // Teto diario: um sabado livre nao vira maratona de dez blocos.
        const key = dayKey(cursor);
        if ((blocksPerDay.get(key) ?? 0) >= options.maxBlocksPerDay) return false;

        // Estudar depois do prazo nao serve para nada.
        if (target.dueDate !== null && cursor >= target.dueDate) return false;

        return true;
      });

      if (slotIndex === -1) break;

      const cursor = cursors[slotIndex] as Date;
      const end = new Date(cursor.getTime() + options.blockMinutes * MS_PER_MINUTE);

      blocks.push({
        title: blockTitle(target, placed, target.desiredBlocks),
        start: new Date(cursor),
        end,
        subjectId: target.subjectId,
        assignmentId: target.kind === 'ASSIGNMENT' ? target.id : null,
        examId: target.kind === 'EXAM' ? target.id : null,
      });

      blocksPerDay.set(dayKey(cursor), (blocksPerDay.get(dayKey(cursor)) ?? 0) + 1);
      cursors[slotIndex] = new Date(end.getTime() + options.breakMinutes * MS_PER_MINUTE);
      placed += 1;
    }

    if (placed === 0) {
      unscheduled.push({
        kind: target.kind,
        title: target.title,
        reason:
          target.dueDate !== null && target.dueDate <= now
            ? 'O prazo já passou'
            : 'Não há tempo livre suficiente antes do prazo',
      });
    } else if (placed < target.desiredBlocks) {
      unscheduled.push({
        kind: target.kind,
        title: target.title,
        reason: `Coube ${placed} de ${target.desiredBlocks} blocos no tempo disponível`,
      });
    }
  }

  return {
    blocks: blocks.sort((a, b) => a.start.getTime() - b.start.getTime()),
    unscheduled,
  };
}

/**
 * Quantos blocos um item merece.
 *
 * Provas exigem mais que atividades, e o que esta perto exige mais que o
 * distante - mas com teto, para um unico item nao monopolizar a semana.
 */
export function desiredBlocksFor(kind: StudyTargetKind, dueDate: Date | null, now: Date): number {
  if (kind === 'SUBJECT') return 1;

  const base = kind === 'EXAM' ? 3 : 2;

  if (dueDate === null) return 1;

  const daysLeft = (dueDate.getTime() - now.getTime()) / MS_PER_DAY;

  // Muito em cima: concentra o esforco. Muito longe: um bloco de aquecimento
  // basta, e o resto vem quando a data se aproximar numa geracao futura.
  if (daysLeft <= 2) return base;
  if (daysLeft <= 7) return base;
  if (daysLeft <= 14) return Math.max(1, base - 1);

  return 1;
}
