import Link from 'next/link';
import { Calculator, Pencil, Plus } from 'lucide-react';
import {
  SUBJECT_GRADE_STATUS_LABELS,
  type GradeListItem,
  type SubjectGradeSummary,
} from '@painel/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_VARIANT } from './subject-grades-card';
import { formatGrade, subjectInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SubjectGradeSummaryCardProps {
  summary: SubjectGradeSummary;
  onAddGrade: (subjectId: string) => void;
  onEditGrade: (grade: GradeListItem) => void;
  onSimulate: (subjectId: string) => void;
}

/** Uma linha de resumo do rodapé, na mesma lógica da projeção do boletim completo. */
function footerLabel(summary: SubjectGradeSummary): string {
  const { average, requiredGrade, pendingComponents } = summary;

  if (average === null) {
    return pendingComponents.length > 0
      ? `Aguardando ${pendingComponents.map((component) => component.name).join(', ')}`
      : 'Nenhuma nota lançada';
  }

  if (requiredGrade === null) return 'Média já fechada';
  if (requiredGrade <= 0) return 'Aprovação garantida';
  if (requiredGrade > 10) return 'Aprovação não é mais possível';

  const missing = pendingComponents.map((component) => component.name).join(', ');

  return `Precisa de ${formatGrade(requiredGrade)}${missing ? ` na ${missing}` : ' no restante'}`;
}

/**
 * Card de disciplina na visão geral de Notas.
 *
 * Mais compacto que `SubjectGradesCard` (usado no boletim completo da
 * disciplina): mostra os componentes como uma grade de mini-cards, não uma
 * lista editável - editar/excluir uma nota específica continua na tela da
 * disciplina, aqui é só visão geral + atalho para lançar e simular.
 */
export function SubjectGradeSummaryCard({
  summary,
  onAddGrade,
  onEditGrade,
  onSimulate,
}: SubjectGradeSummaryCardProps) {
  const { subject, average, grades, pendingComponents, status } = summary;
  const isApproved = average !== null && average >= subject.passingGrade;

  const gradedComponentIds = new Set(grades.map((grade) => grade.gradeComponent.id));

  const items = [
    ...grades.map((grade) => ({
      key: grade.id,
      name: grade.gradeComponent.name,
      weight: grade.gradeComponent.weight,
      value: formatGrade(grade.value),
      filled: true,
      // Nota parcial (isFinal: false): já conta na média; "em aberto" aqui só
      // sinaliza que ainda podem somar mais pontos nesse componente.
      open: !grade.isFinal,
      grade,
    })),
    // Só os componentes SEM nenhuma nota - os "em aberto" com nota parcial já
    // apareceram no map acima, com o valor real lançado.
    ...pendingComponents
      .filter((component) => !gradedComponentIds.has(component.id))
      .map((component) => ({
        key: component.id,
        name: component.name,
        weight: component.weight,
        value: '—',
        filled: false,
        open: true,
        grade: null,
      })),
    // Sem isso a ordem seguiria a data da nota mais recente (grades vem
    // ordenado por gradedAt desc) - os cards trocariam de posição a cada
    // lançamento, em vez de manter N1, N2, N3 sempre no lugar.
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));

  return (
    <div className="rounded-2xl border bg-card p-[18px] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-semibold"
          style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
          aria-hidden
        >
          {subjectInitials(subject.name)}
        </span>

        <Link
          href={`/disciplinas/${subject.id}`}
          className="min-w-0 flex-1 rounded text-[13.5px] font-medium tracking-tight hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="block truncate">{subject.name}</span>
        </Link>

        <Badge variant={STATUS_VARIANT[status]} className="shrink-0">
          {SUBJECT_GRADE_STATUS_LABELS[status]}
        </Badge>
      </div>

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-2">
          {items.map((item) => (
            <div key={item.key} className="relative rounded-[10px] border bg-background/40 p-2.5">
              {item.grade && (
                <button
                  type="button"
                  onClick={() => onEditGrade(item.grade!)}
                  className="absolute top-1.5 right-1.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Editar nota de ${item.name}`}
                >
                  <Pencil className="size-3" aria-hidden />
                </button>
              )}

              <p className="truncate pr-4 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {item.name}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-base leading-none font-semibold tabular-nums',
                  !item.filled && 'text-muted-foreground',
                )}
              >
                {item.value}
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                peso {item.weight}
                {item.open && item.filled && ' · em aberto'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t pt-3.5">
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
          {footerLabel(summary)}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 text-muted-foreground sm:size-7"
            onClick={() => onSimulate(subject.id)}
            aria-label={`Simular notas de ${subject.name}`}
          >
            <Calculator className="size-4" aria-hidden />
          </Button>

          <Button
            variant="accent"
            size="icon"
            className="size-9 sm:size-7"
            onClick={() => onAddGrade(subject.id)}
            aria-label={`Lançar nota em ${subject.name}`}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Média</span>
          <span
            className={cn(
              'text-[19px] leading-none font-semibold tracking-tight tabular-nums',
              average === null
                ? 'text-muted-foreground'
                : isApproved
                  ? 'text-status-completed'
                  : 'text-status-overdue',
            )}
          >
            {formatGrade(average)}
          </span>
        </div>
      </div>
    </div>
  );
}
