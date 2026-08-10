'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  FileStack,
  History,
  Link2,
  ListChecks,
  MapPin,
  NotebookText,
  Pencil,
  RefreshCw,
  Target,
  User,
} from 'lucide-react';
import { SUBJECT_STATUS_LABELS, type GradeListItem } from '@painel/shared';
import { useRestoreSubject, useSubject } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { SubjectFormDialog } from '@/components/subjects/subject-form-dialog';
import { AssignmentList } from '@/components/assignments/assignment-list';
import { ExamList } from '@/components/exams/exam-list';
import { SubjectGradesCard } from '@/components/grades/subject-grades-card';
import { GradeFormDialog } from '@/components/grades/grade-form-dialog';
import { GradeQuickEntryDialog } from '@/components/grades/grade-quick-entry-dialog';
import { GradeConfigurationDialog } from '@/components/grades/grade-configuration-dialog';
import { GradeSimulationDialog } from '@/components/grades/grade-simulation-dialog';
import { NotesPanel } from '@/components/notes/notes-panel';
import { AttachmentList } from '@/components/materials/attachment-list';
import { UploadDropzone } from '@/components/materials/upload-dropzone';
import { LinkFormDialog } from '@/components/materials/link-form-dialog';
import { useSubjectGrades } from '@/hooks/use-grades';
import { formatDate, formatGrade } from '@/lib/format';

/**
 * Detalhes da disciplina.
 *
 * Cada aba reaproveita a mesma lista/componente da tela geral correspondente,
 * apenas recortada por `subjectId` - evita duplicar logica de fetch, dialogo
 * e paginacao entre a visao geral e a visao por disciplina.
 */
export default function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // No Next 16 os params de rota chegam como Promise.
  const { id } = use(params);

  const { data: subject, isLoading, isError, error, refetch } = useSubject(id);
  const { data: gradeSummary } = useSubjectGrades(id);
  const restoreSubject = useRestoreSubject();
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [examPage, setExamPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const [linkOpen, setLinkOpen] = useState(false);
  const [gradeFormOpen, setGradeFormOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeListItem | null>(null);
  const [gradeConfigOpen, setGradeConfigOpen] = useState(false);
  const [gradeSimOpen, setGradeSimOpen] = useState(false);
  const [gradeQuickEntryOpen, setGradeQuickEntryOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !subject) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Disciplina não encontrada"
            description={error instanceof Error ? error.message : 'Ela pode ter sido excluída.'}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Tentar novamente
                </Button>
                <Button size="sm" asChild>
                  <Link href="/disciplinas">Voltar</Link>
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const isArchived = subject.archivedAt !== null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/disciplinas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Disciplinas
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: subject.color }}
            aria-hidden
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{subject.name}</h1>
              {subject.code && (
                <span className="text-sm text-muted-foreground tabular-nums">{subject.code}</span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" aria-hidden />
                {subject.teacher?.name ?? 'Sem professor'}
              </span>

              {subject.room && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {subject.room}
                </span>
              )}

              {subject.semester && <span>{subject.semester.name}</span>}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {isArchived && <Badge variant="secondary">Arquivada</Badge>}
              <Badge variant={subject.status === 'APPROVED' ? 'completed' : 'outline'}>
                {SUBJECT_STATUS_LABELS[subject.status]}
              </Badge>
              {subject.credits !== null && (
                <Badge variant="outline">{subject.credits} créditos</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isArchived && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void restoreSubject.mutateAsync(subject.id)}
            >
              <ArchiveRestore className="size-4" aria-hidden />
              Restaurar
            </Button>
          )}

          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        </div>
      </div>

      {/* Números da disciplina */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Média atual</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatGrade(subject.average)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subject.gradeCount === 0
              ? 'Nenhuma nota lançada'
              : `${subject.gradeCount} ${subject.gradeCount === 1 ? 'nota lançada' : 'notas lançadas'}`}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Para aprovação</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatGrade(subject.passingGrade)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            {/* Estimativa: assume peso total 10 no semestre. Refinada na Etapa 10. */}
            {subject.requiredGrade === null ? (
              'Sem estimativa ainda'
            ) : subject.requiredGrade <= 0 ? (
              <>
                <Target className="size-3" aria-hidden />
                Aprovação garantida
              </>
            ) : subject.requiredGrade > 10 ? (
              'Aprovação inviável pela média'
            ) : (
              <>
                <Target className="size-3" aria-hidden />
                Precisa de {formatGrade(subject.requiredGrade)} no restante
              </>
            )}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Pendências</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {subject.pendingAssignmentCount}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subject.upcomingExamCount > 0
              ? `${subject.upcomingExamCount} ${subject.upcomingExamCount === 1 ? 'prova a caminho' : 'provas a caminho'}`
              : 'Nenhuma prova marcada'}
          </p>
        </Card>
      </div>

      {/* Abas */}
      {/* Seis abas nao cabem inteiras num celular; abaixo de `sm` so o icone
          aparece (rotulo continua no aria-label, para leitor de tela), o que
          evita depender so da rolagem horizontal para descobrir as demais. */}
      <Tabs defaultValue="atividades">
        <TabsList>
          <TabsTrigger value="atividades" aria-label="Atividades">
            <ListChecks aria-hidden />
            <span className="hidden sm:inline">Atividades</span>
          </TabsTrigger>
          <TabsTrigger value="provas" aria-label="Provas">
            <ClipboardList aria-hidden />
            <span className="hidden sm:inline">Provas</span>
          </TabsTrigger>
          <TabsTrigger value="notas" aria-label="Notas">
            <BookOpen aria-hidden />
            <span className="hidden sm:inline">Notas</span>
          </TabsTrigger>
          <TabsTrigger value="materiais" aria-label="Materiais">
            <FileStack aria-hidden />
            <span className="hidden sm:inline">Materiais</span>
          </TabsTrigger>
          <TabsTrigger value="anotacoes" aria-label="Anotações">
            <NotebookText aria-hidden />
            <span className="hidden sm:inline">Anotações</span>
          </TabsTrigger>
          <TabsTrigger value="historico" aria-label="Histórico">
            <History aria-hidden />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="mt-4">
          {/* Mesma lista da tela de Atividades, recortada por disciplina. */}
          <AssignmentList
            params={{
              subjectId: subject.id,
              view: 'todas',
              sortBy: 'dueDate',
              order: 'asc',
              page: assignmentPage,
              perPage: 10,
            }}
            onPageChange={setAssignmentPage}
            defaultSubjectId={subject.id}
          />
        </TabsContent>

        <TabsContent value="provas" className="mt-4">
          <ExamList
            params={{
              subjectId: subject.id,
              view: 'todas',
              sortBy: 'date',
              order: 'asc',
              page: examPage,
              perPage: 10,
            }}
            onPageChange={setExamPage}
            defaultSubjectId={subject.id}
          />
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          {/* Mesmo boletim da tela de Notas, recortado nesta disciplina. */}
          {gradeSummary ? (
            <SubjectGradesCard
              summary={gradeSummary}
              onAddGrade={() => setGradeQuickEntryOpen(true)}
              onEditGrade={(grade) => {
                setEditingGrade(grade);
                setGradeFormOpen(true);
              }}
              onConfigure={() => setGradeConfigOpen(true)}
              onSimulate={() => setGradeSimOpen(true)}
            />
          ) : (
            <Skeleton className="h-44 rounded-xl" />
          )}
        </TabsContent>

        <TabsContent value="materiais" className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <UploadDropzone target={{ subjectId: subject.id }} />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              Adicionar link
            </Button>
          </div>

          {/* Mesma lista da tela de Materiais, recortada por disciplina. */}
          <AttachmentList
            params={{
              subjectId: subject.id,
              sortBy: 'createdAt',
              order: 'desc',
              page: materialPage,
              perPage: 9,
            }}
            onPageChange={setMaterialPage}
          />

          <LinkFormDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            defaultSubjectId={subject.id}
          />
        </TabsContent>

        <TabsContent value="anotacoes" className="mt-4">
          <NotesPanel subjectId={subject.id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Provas realizadas</p>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                Avaliações que já aconteceram, com a nota quando lançada.
              </p>

              {/* Mesma lista de provas, recortada em "realizadas" e da mais
                  recente para a mais antiga. */}
              <ExamList
                params={{
                  subjectId: subject.id,
                  view: 'realizadas',
                  sortBy: 'date',
                  order: 'desc',
                  page: historyPage,
                  perPage: 10,
                }}
                onPageChange={setHistoryPage}
                defaultSubjectId={subject.id}
              />
            </div>

            <Card>
              <CardContent className="space-y-3 py-5">
                <p className="text-sm font-medium">Linha do tempo</p>

                <div className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <div>
                    <p>Disciplina criada</p>
                    <p className="text-xs text-muted-foreground">{formatDate(subject.createdAt)}</p>
                  </div>
                </div>

                {isArchived && subject.archivedAt && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    <div>
                      <p>Arquivada</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(subject.archivedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <SubjectFormDialog open={editOpen} onOpenChange={setEditOpen} subject={subject} />

      <GradeFormDialog
        open={gradeFormOpen}
        onOpenChange={setGradeFormOpen}
        grade={editingGrade}
        defaultSubjectId={subject.id}
      />

      <GradeConfigurationDialog
        open={gradeConfigOpen}
        onOpenChange={setGradeConfigOpen}
        subjectId={subject.id}
        subjectName={subject.name}
      />

      <GradeSimulationDialog
        open={gradeSimOpen}
        onOpenChange={setGradeSimOpen}
        subjectId={subject.id}
        subjectName={subject.name}
      />

      <GradeQuickEntryDialog
        open={gradeQuickEntryOpen}
        onOpenChange={setGradeQuickEntryOpen}
        subjectId={subject.id}
        subjectName={subject.name}
      />
    </div>
  );
}
