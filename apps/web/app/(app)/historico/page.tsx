'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  EllipsisVertical,
  GraduationCap,
  History,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { HistorySemester, HistorySubject, SemesterListItem } from '@painel/shared';
import { SUBJECT_STATUS_LABELS } from '@painel/shared';
import {
  useDeleteSemester,
  useHistory,
  useReopenSemester,
  useSemesters,
} from '@/hooks/use-semesters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard, StatCardSkeleton } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
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
import { SemesterFormDialog } from '@/components/history/semester-form-dialog';
import { CloseSemesterDialog } from '@/components/history/close-semester-dialog';
import { formatDate, formatGrade, subjectInitials } from '@/lib/format';

/** Cor do badge conforme a situação da disciplina. */
const SUBJECT_VARIANT = {
  APPROVED: 'completed',
  FAILED: 'overdue',
  WITHDRAWN: 'secondary',
  IN_PROGRESS: 'secondary',
} as const;

/**
 * Uma disciplina dentro do histórico.
 *
 * `compact` tira professor/créditos, a marca "final" e o status - usado na
 * lista de "sem período", que é um lembrete leve, não o resumo do semestre.
 */
function HistorySubjectRow({
  subject,
  compact = false,
}: {
  subject: HistorySubject;
  compact?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-semibold"
        style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
        aria-hidden
      >
        {subjectInitials(subject.name, subject.code)}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/disciplinas/${subject.id}`}
          className="block truncate text-sm transition-colors hover:text-primary"
        >
          {subject.name}
        </Link>

        {!compact && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subject.teacherName ?? 'Sem professor'}
            {subject.credits !== null && ` · ${subject.credits} créditos`}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatGrade(subject.average)}</p>
        {/* Distingue média congelada de média ainda em cálculo. */}
        {!compact && subject.isConsolidated && (
          <p className="text-[10px] text-muted-foreground">final</p>
        )}
      </div>

      {!compact && (
        <Badge variant={SUBJECT_VARIANT[subject.status]} className="shrink-0">
          {SUBJECT_STATUS_LABELS[subject.status]}
        </Badge>
      )}
    </li>
  );
}

function SemesterCard({
  semester,
  listItem,
  onEdit,
  onClose,
  onReopen,
  onDelete,
}: {
  semester: HistorySemester;
  listItem: SemesterListItem | undefined;
  onEdit: (semester: SemesterListItem) => void;
  onClose: (semester: SemesterListItem) => void;
  onReopen: (id: string) => void;
  onDelete: (semester: SemesterListItem) => void;
}) {
  const isFinished = semester.status === 'FINISHED';

  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
      <CardHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{semester.name}</p>

            {semester.isCurrent && <Badge>Atual</Badge>}
            {isFinished && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" aria-hidden />
                Encerrado
              </Badge>
            )}
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(semester.startDate)} — {formatDate(semester.endDate)} ·{' '}
            {semester.subjects.length}{' '}
            {semester.subjects.length === 1 ? 'disciplina' : 'disciplinas'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Média</p>
            <p className="text-lg leading-tight font-semibold tabular-nums">
              {formatGrade(semester.average)}
            </p>
          </div>

          {listItem && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Ações de ${semester.name}`}
                >
                  <EllipsisVertical className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(listItem)}>
                  <Pencil aria-hidden />
                  Editar
                </DropdownMenuItem>

                {isFinished ? (
                  <DropdownMenuItem onClick={() => onReopen(semester.id)}>
                    <LockOpen aria-hidden />
                    Reabrir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onClose(listItem)}>
                    <Lock aria-hidden />
                    Encerrar semestre
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem variant="destructive" onClick={() => onDelete(listItem)}>
                  <Trash2 aria-hidden />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <strong className="text-status-completed">{semester.approvedCount}</strong> aprovadas
          </span>
          {semester.failedCount > 0 && (
            <span>
              <strong className="text-status-overdue">{semester.failedCount}</strong> reprovadas
            </span>
          )}
          {semester.inProgressCount > 0 && (
            <span>
              <strong className="text-foreground">{semester.inProgressCount}</strong> em andamento
            </span>
          )}
          <span>
            <strong className="text-foreground">{semester.earnedCredits}</strong> de{' '}
            {semester.totalCredits} créditos
          </span>
        </div>

        {semester.subjects.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Nenhuma disciplina neste período.
          </p>
        ) : (
          <ul className="-mx-2 divide-y">
            {semester.subjects.map((subject) => (
              <HistorySubjectRow key={subject.id} subject={subject} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const { data, isLoading, isError, error, refetch } = useHistory();
  const { data: semesters } = useSemesters();
  const reopenSemester = useReopenSemester();
  const deleteSemester = useDeleteSemester();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SemesterListItem | null>(null);
  const [closing, setClosing] = useState<SemesterListItem | null>(null);
  const [deleting, setDeleting] = useState<SemesterListItem | null>(null);

  const byId = new Map((semesters ?? []).map((item) => [item.id, item]));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Histórico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu percurso acadêmico, período por período.
          </p>
        </div>

        <Button
          variant="accent"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo semestre</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : isError || !data ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar o histórico"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : data.semesters.length === 0 && data.unassignedSubjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="Nenhum semestre cadastrado"
            description="Crie um período letivo para organizar suas disciplinas e acompanhar o histórico."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Criar semestre
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Resumo acumulado */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Coeficiente"
              value={formatGrade(data.overallCr)}
              icon={Award}
              hint="Ponderado por créditos"
              tone="info"
            />

            <StatCard
              label="Créditos concluídos"
              value={data.earnedCredits}
              icon={GraduationCap}
              hint={`de ${data.totalCredits} cursados`}
              tone="violet"
            />

            <StatCard
              label="Disciplinas"
              value={data.approvedSubjects}
              icon={CheckCircle2}
              hint={
                data.failedSubjects > 0
                  ? `aprovadas · ${data.failedSubjects} reprovadas`
                  : 'aprovadas'
              }
              tone="success"
            />
          </div>

          <div className="space-y-4">
            {data.semesters.map((semester) => (
              <SemesterCard
                key={semester.id}
                semester={semester}
                listItem={byId.get(semester.id)}
                onEdit={(item) => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                onClose={setClosing}
                onReopen={(id) => reopenSemester.mutate(id)}
                onDelete={setDeleting}
              />
            ))}
          </div>

          {/* Disciplinas sem período: visíveis, mas separadas. */}
          {data.unassignedSubjects.length > 0 && (
            <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
              <CardHeader>
                <div>
                  <p className="text-sm font-semibold">Sem período atribuído</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Edite a disciplina para vinculá-la a um semestre.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                <ul className="-mx-2 divide-y">
                  {data.unassignedSubjects.map((subject) => (
                    <HistorySubjectRow key={subject.id} subject={subject} compact />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <SemesterFormDialog open={formOpen} onOpenChange={setFormOpen} semester={editing} />

      <CloseSemesterDialog semester={closing} onOpenChange={(open) => !open && setClosing(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              As {deleting?.subjectCount ?? 0} disciplinas deste período{' '}
              <strong className="text-foreground">não serão excluídas</strong> — apenas ficarão sem
              período atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteSemester.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir semestre
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
