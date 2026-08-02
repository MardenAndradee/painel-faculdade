'use client';

import { useState } from 'react';
import { EllipsisVertical, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import type { GradeListItem, SubjectGradeSummary } from '@painel/shared';
import { GRADE_TYPE_LABELS, SUBJECT_GRADE_STATUS_LABELS } from '@painel/shared';
import { useDeleteGrade } from '@/hooks/use-grades';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDate, formatGrade } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SubjectGradesCardProps {
  summary: SubjectGradeSummary;
  onAddGrade: (subjectId: string) => void;
  onEditGrade: (grade: GradeListItem) => void;
}

/** Cor do badge conforme a situação projetada. */
const STATUS_VARIANT: Record<
  SubjectGradeSummary['status'],
  'completed' | 'overdue' | 'pending' | 'secondary'
> = {
  APROVADO: 'completed',
  REPROVADO: 'overdue',
  EM_RECUPERACAO: 'pending',
  EM_ANDAMENTO: 'secondary',
  SEM_NOTAS: 'secondary',
};

/**
 * Boletim de uma disciplina.
 *
 * Além das notas, mostra a projeção de aprovação — a informação que o
 * estudante realmente quer: "quanto preciso tirar no que falta".
 */
export function SubjectGradesCard({ summary, onAddGrade, onEditGrade }: SubjectGradesCardProps) {
  const [deleting, setDeleting] = useState<GradeListItem | null>(null);
  const deleteGrade = useDeleteGrade();

  const { subject, grades, average, requiredGrade, remainingWeight, status } = summary;
  const isApproved = average !== null && average >= subject.passingGrade;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-9 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: subject.color }}
            aria-hidden
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold">{subject.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aprovação com {formatGrade(subject.passingGrade)} ·{' '}
              {grades.length === 0
                ? 'nenhuma nota'
                : `${grades.length} ${grades.length === 1 ? 'nota' : 'notas'}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Média</p>
            <p
              className={cn(
                'text-xl leading-tight font-semibold tabular-nums',
                average === null
                  ? 'text-muted-foreground'
                  : isApproved
                    ? 'text-status-completed'
                    : 'text-status-overdue',
              )}
            >
              {formatGrade(average)}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onAddGrade(subject.id)}
            aria-label={`Lançar nota em ${subject.name}`}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {/* Projeção de aprovação */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[status]}>{SUBJECT_GRADE_STATUS_LABELS[status]}</Badge>

          {requiredGrade !== null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" aria-hidden />
              {requiredGrade <= 0
                ? 'Aprovação garantida'
                : requiredGrade > 10
                  ? 'Aprovação não é mais possível pela média'
                  : `Precisa de ${formatGrade(requiredGrade)} no restante`}
            </span>
          )}

          {/* Sem provas pendentes não há como projetar — e dizemos isso. */}
          {requiredGrade === null && average !== null && remainingWeight === null && (
            <span className="text-xs text-muted-foreground">
              Cadastre as provas restantes para ver a projeção
            </span>
          )}
        </div>

        {grades.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Nenhuma nota lançada ainda.
          </p>
        ) : (
          <ul className="-mx-2 divide-y">
            {grades.map((grade) => (
              <li
                key={grade.id}
                className="flex items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {grade.label || GRADE_TYPE_LABELS[grade.type]}
                    {/* O tipo só aparece quando acrescenta informação: um
                        rótulo igual ao tipo viraria "Seminário Seminário". */}
                    {grade.label &&
                      grade.label.toLowerCase() !== GRADE_TYPE_LABELS[grade.type].toLowerCase() && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {GRADE_TYPE_LABELS[grade.type]}
                        </span>
                      )}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(grade.gradedAt)}
                    {grade.weight !== 1 && ` · peso ${grade.weight}`}
                    {grade.exam && ' · vinculada à prova'}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatGrade(grade.value)}
                    {grade.maxValue !== 10 && (
                      <span className="text-xs text-muted-foreground">/{grade.maxValue}</span>
                    )}
                  </p>
                  {/* Notas fora da escala 0-10 mostram o equivalente. */}
                  {grade.maxValue !== 10 && (
                    <p className="text-[11px] text-muted-foreground">
                      = {formatGrade(grade.normalized)}
                    </p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Ações da nota ${grade.label || GRADE_TYPE_LABELS[grade.type]}`}
                    >
                      <EllipsisVertical className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditGrade(grade)}>
                      <Pencil aria-hidden />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(grade)}>
                      <Trash2 aria-hidden />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}

        {summary.pendingExams.length > 0 && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            {summary.pendingExams.length}{' '}
            {summary.pendingExams.length === 1 ? 'prova sem nota' : 'provas sem nota'} · peso{' '}
            {formatGrade(remainingWeight)} restante
          </p>
        )}
      </CardContent>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              A média de {subject.name} será recalculada sem esta nota.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteGrade.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
