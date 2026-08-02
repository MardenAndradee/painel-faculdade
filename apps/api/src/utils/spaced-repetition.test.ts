import { describe, expect, it } from 'vitest';
import { previewIntervals, scheduleNextReview, type SchedulingState } from './spaced-repetition.js';

/**
 * Testes do SM-2.
 *
 * O `agora` e sempre injetado: sem isso um teste que passa as 23h50 falharia
 * as 00h10, e a suite viraria fonte de ruido em vez de sinal.
 */

const NOW = new Date(2026, 7, 3, 14, 30, 0, 0);
const NEW_CARD: SchedulingState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
/** Cartao maduro: 30 dias de intervalo, cinco acertos seguidos. */
const MATURE_CARD: SchedulingState = { easeFactor: 2.6, intervalDays: 30, repetitions: 5 };

/** Aplica varias avaliacoes em sequencia, como faria o aluno. */
function replay(state: SchedulingState, qualities: (0 | 3 | 4 | 5)[]): SchedulingState {
  return qualities.reduce<SchedulingState>((current, quality) => {
    const next = scheduleNextReview(current, quality, NOW);

    return {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
    };
  }, state);
}

describe('scheduleNextReview', () => {
  describe('cartão novo', () => {
    it('agenda o primeiro acerto para amanhã', () => {
      const result = scheduleNextReview(NEW_CARD, 4, NOW);

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.dueDate.getDate()).toBe(4);
    });

    it('agenda o segundo acerto para seis dias', () => {
      const result = scheduleNextReview(replay(NEW_CARD, [4]), 4, NOW);

      expect(result.intervalDays).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('multiplica pelo ease factor a partir do terceiro acerto', () => {
      const state = replay(NEW_CARD, [4, 4]);
      const result = scheduleNextReview(state, 4, NOW);

      expect(result.intervalDays).toBe(Math.round(state.intervalDays * result.easeFactor));
    });

    it('zera a hora do vencimento para o cartão abrir cedo', () => {
      // Revisar as 23h59 tem que agendar para o DIA seguinte, nao para 24h
      // depois - do contrario o cartao so reapareceria a noite.
      const lateNight = new Date(2026, 7, 3, 23, 59, 0, 0);
      const result = scheduleNextReview(NEW_CARD, 4, lateNight);

      expect(result.dueDate.getHours()).toBe(0);
      expect(result.dueDate.getMinutes()).toBe(0);
      expect(result.dueDate.getDate()).toBe(4);
    });
  });

  describe('efeito da nota sobre o ease factor', () => {
    it('mantém o fator quando a resposta é "Bom"', () => {
      expect(scheduleNextReview(NEW_CARD, 4, NOW).easeFactor).toBe(2.5);
    });

    it('aumenta o fator quando a resposta é "Fácil"', () => {
      expect(scheduleNextReview(NEW_CARD, 5, NOW).easeFactor).toBeGreaterThan(2.5);
    });

    it('reduz o fator quando a resposta é "Difícil"', () => {
      expect(scheduleNextReview(NEW_CARD, 3, NOW).easeFactor).toBeLessThan(2.5);
    });

    it('penaliza o erro mais que o "Difícil"', () => {
      expect(scheduleNextReview(NEW_CARD, 0, NOW).easeFactor).toBeLessThan(
        scheduleNextReview(NEW_CARD, 3, NOW).easeFactor,
      );
    });

    it('nunca deixa o fator cair abaixo de 1,3', () => {
      // Sem esse piso, um cartao errado sempre teria o fator empurrado para
      // perto de zero e ficaria preso repetindo todo dia para sempre.
      const punished = replay(
        NEW_CARD,
        Array.from({ length: 20 }, () => 0 as const),
      );

      expect(punished.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe('erro', () => {
    it('zera a sequência e devolve o cartão para amanhã', () => {
      const result = scheduleNextReview(MATURE_CARD, 0, NOW);

      expect(result.repetitions).toBe(0);
      expect(result.intervalDays).toBe(1);
    });

    it('conta como lapso quando o cartão já era acertado', () => {
      expect(scheduleNextReview(MATURE_CARD, 0, NOW).isLapse).toBe(true);
    });

    it('NÃO conta como lapso num cartão novo', () => {
      // Errar algo que nunca se acertou nao e regressao; contar como lapso
      // inflaria a estatistica de erro de quem esta comecando.
      expect(scheduleNextReview(NEW_CARD, 0, NOW).isLapse).toBe(false);
    });

    it('descarta o intervalo longo que o cartão tinha conquistado', () => {
      // O intervalo de 30 dias era baseado numa retencao que a resposta acabou
      // de desmentir.
      expect(scheduleNextReview(MATURE_CARD, 0, NOW).intervalDays).toBeLessThan(
        MATURE_CARD.intervalDays,
      );
    });
  });

  describe('crescimento de longo prazo', () => {
    it('faz os intervalos crescerem a cada acerto', () => {
      const intervals: number[] = [];
      let state = NEW_CARD;

      for (let i = 0; i < 8; i++) {
        const next = scheduleNextReview(state, 4, NOW);
        intervals.push(next.intervalDays);
        state = {
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
        };
      }

      expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
      expect(new Set(intervals).size).toBe(intervals.length);
    });

    it('ultrapassa o corte de "dominado" (21 dias) até a quinta revisão', () => {
      const state = replay(NEW_CARD, [4, 4, 4, 4]);

      expect(state.intervalDays).toBeGreaterThanOrEqual(21);
    });
  });

  it('é determinístico: mesma entrada, mesma saída', () => {
    expect(scheduleNextReview(MATURE_CARD, 4, NOW)).toEqual(
      scheduleNextReview(MATURE_CARD, 4, NOW),
    );
  });

  it('não muta o estado recebido', () => {
    const state = { ...MATURE_CARD };
    scheduleNextReview(state, 0, NOW);

    expect(state).toEqual(MATURE_CARD);
  });
});

describe('previewIntervals', () => {
  it('cobre as quatro notas', () => {
    expect(Object.keys(previewIntervals(NEW_CARD, NOW))).toHaveLength(4);
  });

  it('ordena os intervalos por generosidade da nota num cartão maduro', () => {
    const preview = previewIntervals(MATURE_CARD, NOW);

    expect(preview[0]).toBe(1);
    expect(preview[3]).toBeLessThan(preview[4]);
    expect(preview[4]).toBeLessThan(preview[5]);
  });

  it('não altera o cartão', () => {
    const state = { ...MATURE_CARD };
    previewIntervals(state, NOW);

    expect(state).toEqual(MATURE_CARD);
  });
});
