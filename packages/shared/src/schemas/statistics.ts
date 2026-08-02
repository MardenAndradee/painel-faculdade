import { z } from 'zod';

/**
 * Contrato das estatisticas.
 *
 * Tudo vem num unico payload: cinco graficos na mesma tela seriam cinco
 * viagens de rede se cada um tivesse seu endpoint. As consultas rodam em
 * paralelo no servidor, que ja tem o custo de uma conexao aberta.
 */

/** Recortes de periodo oferecidos pelo filtro. */
export const STATS_PERIODS = ['30', '90', '180', '365'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  '180': 'Últimos 6 meses',
  '365': 'Último ano',
};

export const statisticsQuerySchema = z.object({
  period: z.enum(STATS_PERIODS).default('90'),
});

export type StatisticsQuery = z.infer<typeof statisticsQuerySchema>;

/** Ponto de uma serie temporal. A data vem como "YYYY-MM-DD". */
export interface TimePoint {
  date: string;
  value: number;
}

/** Barra de uma comparacao por categoria. */
export interface CategoryValue {
  id: string;
  label: string;
  value: number;
  /** Cor da propria entidade, quando ela tiver uma (disciplinas). */
  color?: string;
}

/** Números de destaque. Cada um e um valor, nao um grafico. */
export interface StatisticsHighlights {
  /** Media geral das disciplinas em andamento. Nulo sem notas. */
  currentAverage: number | null;
  /** Coeficiente de rendimento consolidado. Nulo sem semestre encerrado. */
  overallCr: number | null;
  /** Atividades concluidas no periodo. */
  completedAssignments: number;
  /** Percentual de entregas feitas ate o prazo. Nulo sem entregas. */
  onTimeRate: number | null;
  /** Minutos efetivamente estudados no periodo. */
  studiedMinutes: number;
  /** Revisoes de flashcards no periodo. */
  flashcardReviews: number;
  /** Cartoes com intervalo longo o bastante para contar como aprendidos. */
  masteredCards: number;
  /** Dias seguidos com alguma atividade de estudo. */
  streakDays: number;
}

/** Situacao das atividades no periodo, para a barra empilhada. */
export interface AssignmentBreakdown {
  completedOnTime: number;
  completedLate: number;
  pending: number;
  overdue: number;
}

export interface StatisticsResponse {
  period: StatsPeriod;
  /** Inicio do recorte, para a tela poder rotular o eixo. */
  from: string;
  to: string;

  highlights: StatisticsHighlights;

  /** Média por disciplina em andamento — responde "onde estou mal?". */
  averageBySubject: CategoryValue[];

  /** Evolucao da media por semestre encerrado — responde "estou melhorando?". */
  averageBySemester: { id: string; label: string; average: number | null; cr: number | null }[];

  /** Minutos estudados por dia. */
  studyMinutesByDay: TimePoint[];

  /** Revisoes de flashcards por dia. Escala diferente do estudo, grafico proprio. */
  reviewsByDay: TimePoint[];

  /** Atividades concluidas por semana do periodo. */
  completedByWeek: TimePoint[];

  assignmentBreakdown: AssignmentBreakdown;

  /** Minutos estudados por disciplina. */
  studyMinutesBySubject: CategoryValue[];
}
