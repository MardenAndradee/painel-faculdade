interface CompletionBarProps {
  rate: number | null;
}

/**
 * Barra de "Itens concluídos" do Plano de Estudos.
 *
 * De propósito, NÃO se chama "Preparação": mede só a fração objetiva de
 * conteúdos+objetivos marcados como concluídos, nunca uma estimativa de
 * quão pronto o aluno está pra prova (ver docs/planning/plano-de-estudos.md).
 * Sem itens cadastrados ainda, não há o que medir - a barra fica de fora.
 */
export function CompletionBar({ rate }: CompletionBarProps) {
  if (rate === null) return null;

  const percent = Math.round(rate * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">Itens concluídos</p>
        <p className="text-xs font-semibold tabular-nums">{percent}%</p>
      </div>

      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Itens concluídos"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
