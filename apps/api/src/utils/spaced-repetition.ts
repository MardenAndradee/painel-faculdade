/**
 * Repeticao espacada (SM-2).
 *
 * Funcao pura, sem banco e sem data implicita: recebe o estado atual do cartao
 * e a nota do aluno, devolve o proximo estado. Isso e o que permite testar o
 * agendamento sem subir servidor, e o que impede a regra de vazar para o
 * repositorio.
 *
 * O algoritmo e o SM-2 (Piotr Wozniak, 1987), a base do Anki. A escolha nao e
 * gratuita: mostrar todos os cartoes do baralho a cada estudo faz o aluno
 * gastar tempo no que ja sabe, que e exatamente o que flashcards deveriam
 * evitar.
 */

/** Nota que o aluno da a si mesmo, de 0 (errou) a 5 (facil). */
export const REVIEW_QUALITIES = [0, 3, 4, 5] as const;
export type ReviewQuality = (typeof REVIEW_QUALITIES)[number];

/**
 * Piso do fator de facilidade.
 *
 * Sem ele, um cartao que o aluno erra sempre teria o fator empurrado para
 * perto de zero e ficaria preso repetindo todo dia para sempre.
 */
const MIN_EASE_FACTOR = 1.3;

/** Acertar de primeira agenda para amanha; o segundo acerto, para seis dias. */
const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 6;

/** Nota a partir da qual a resposta conta como acerto. */
const PASSING_QUALITY = 3;

export interface SchedulingState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SchedulingResult extends SchedulingState {
  dueDate: Date;
  /** Verdadeiro quando o aluno errou um cartao que ja acertava. */
  isLapse: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Soma dias mantendo o horario, para que a fila do dia seguinte abra cedo. */
function addDays(from: Date, days: number): Date {
  const result = new Date(from.getTime() + days * MS_PER_DAY);

  // Zera a hora: o que importa e o DIA em que o cartao volta. Sem isso, um
  // cartao revisado as 23h so reapareceria as 23h do dia seguinte.
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Calcula o proximo agendamento.
 *
 * @param state estado atual do cartao
 * @param quality nota dada pelo aluno
 * @param now momento da revisao, injetado para tornar o calculo deterministico
 */
export function scheduleNextReview(
  state: SchedulingState,
  quality: ReviewQuality,
  now: Date = new Date(),
): SchedulingResult {
  // O fator de facilidade se ajusta em toda revisao, inclusive nos erros: um
  // cartao errado fica permanentemente mais "caro" e volta com mais frequencia
  // mesmo depois que o aluno recomeca a acerta-lo.
  const rawEase = state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const easeFactor = Math.max(MIN_EASE_FACTOR, Number(rawEase.toFixed(2)));

  if (quality < PASSING_QUALITY) {
    // Errou: a sequencia zera e o cartao volta amanha. O intervalo longo que
    // ele tinha conquistado e descartado - era baseado numa retencao que a
    // resposta acabou de desmentir.
    return {
      easeFactor,
      intervalDays: FIRST_INTERVAL_DAYS,
      repetitions: 0,
      dueDate: addDays(now, FIRST_INTERVAL_DAYS),
      isLapse: state.repetitions > 0,
    };
  }

  const repetitions = state.repetitions + 1;

  const intervalDays =
    repetitions === 1
      ? FIRST_INTERVAL_DAYS
      : repetitions === 2
        ? SECOND_INTERVAL_DAYS
        : Math.round(state.intervalDays * easeFactor);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueDate: addDays(now, intervalDays),
    isLapse: false,
  };
}

/**
 * Previsao do intervalo para cada nota, sem alterar o cartao.
 *
 * Usada para mostrar "Bom · 6 dias" nos botoes: o aluno decide melhor quando
 * ve a consequencia da escolha antes de clicar.
 */
export function previewIntervals(
  state: SchedulingState,
  now: Date = new Date(),
): Record<ReviewQuality, number> {
  const entries = REVIEW_QUALITIES.map(
    (quality) => [quality, scheduleNextReview(state, quality, now).intervalDays] as const,
  );

  return Object.fromEntries(entries) as Record<ReviewQuality, number>;
}
