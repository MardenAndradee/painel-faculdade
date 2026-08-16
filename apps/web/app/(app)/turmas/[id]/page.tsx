'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  AlertTriangle,
  ArrowLeft,
  Crown,
  FileStack,
  FileText,
  FlagTriangleRight,
  GraduationCap,
  HardDrive,
  History,
  Link2,
  LogOut,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  CLASS_ROLE_LABELS,
  defaultSemesterName,
  type ClassAnnouncementItem,
  type ClassMaterialItem,
  type ClassPostKind,
  type ClassSubjectItem,
} from '@painel/shared';
import {
  useArchiveClass,
  useClass,
  useClassHistory,
  useClassMembers,
  useLeaveClass,
  useRemoveClassSubject,
  useUnarchiveClass,
} from '@/hooks/use-classes';
import { useClassPosts, useRemoveClassPost, useUpcomingClassPosts } from '@/hooks/use-class-posts';
import { useClassAnnouncements, useRemoveClassAnnouncement } from '@/hooks/use-class-announcements';
import { useClassNotes, useRemoveClassNote } from '@/hooks/use-class-notes';
import {
  useClassMaterials,
  useClassMaterialSummary,
  useRemoveClassMaterial,
} from '@/hooks/use-class-materials';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { ClassInviteDialog } from '@/components/classes/class-invite-dialog';
import { ClassFormDialog } from '@/components/classes/class-form-dialog';
import { ClassSubjectDialog } from '@/components/classes/class-subject-dialog';
import { ClassPostFormDialog } from '@/components/classes/class-post-form-dialog';
import { ClassPostRow } from '@/components/classes/class-post-row';
import { ClassAnnouncementDialog } from '@/components/classes/class-announcement-dialog';
import { ClassNoteDialog } from '@/components/classes/class-note-dialog';
import { ClassMaterialUploadDropzone } from '@/components/classes/class-material-upload-dropzone';
import { ClassMaterialLinkDialog } from '@/components/classes/class-material-link-dialog';
import { ClassMaterialCard } from '@/components/classes/class-material-card';
import { ClassTransferOwnerDialog } from '@/components/classes/class-transfer-owner-dialog';
import { ClassHealthPanel } from '@/components/classes/class-health-panel';
import { FinishSemesterDialog } from '@/components/classes/finish-semester-dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatBytes, formatDate, formatRelative, subjectInitials } from '@/lib/format';

const POST_KIND_SECTIONS: Array<{ kind: ClassPostKind; label: string }> = [
  { kind: 'EXAM', label: 'Provas' },
  { kind: 'ASSIGNMENT', label: 'Atividades' },
  { kind: 'EVENT', label: 'Eventos' },
];

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { user } = useAuth();
  const { data: classItem, isLoading, isError, error, refetch } = useClass(id);
  const { data: members } = useClassMembers(id);
  const { data: upcomingPosts } = useUpcomingClassPosts(id);
  const { data: posts } = useClassPosts(id);
  const { data: announcements } = useClassAnnouncements(id);
  const { data: notes } = useClassNotes(id);
  const { data: materials } = useClassMaterials(id);
  const { data: materialSummary } = useClassMaterialSummary(id);
  const { data: history } = useClassHistory(id);
  const leaveClass = useLeaveClass();
  const removeSubject = useRemoveClassSubject();
  const removePost = useRemoveClassPost(id);
  const removeAnnouncement = useRemoveClassAnnouncement(id);
  const removeNote = useRemoveClassNote(id);
  const removeMaterial = useRemoveClassMaterial(id);
  const archiveClass = useArchiveClass();
  const unarchiveClass = useUnarchiveClass();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ClassSubjectItem | null>(null);
  const [removingSubject, setRemovingSubject] = useState<ClassSubjectItem | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<ClassAnnouncementItem | null>(
    null,
  );
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [materialLinkOpen, setMaterialLinkOpen] = useState(false);
  const [removingMaterial, setRemovingMaterial] = useState<ClassMaterialItem | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [finishSemesterOpen, setFinishSemesterOpen] = useState(false);

  const pinnedAnnouncements = (announcements ?? []).filter((item) => item.pinned);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !classItem) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Turma não encontrada"
            description={error instanceof Error ? error.message : 'Ela pode não existir mais.'}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Tentar novamente
                </Button>
                <Button size="sm" asChild>
                  <Link href="/turmas">Voltar</Link>
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const isOwner = classItem.myRole === 'OWNER';
  const isArchived = classItem.archivedAt !== null;
  const transferCandidates = (members ?? []).filter((member) => member.user.id !== user?.id);

  const openAddSubject = (): void => {
    setEditingSubject(null);
    setSubjectDialogOpen(true);
  };

  const openEditSubject = (subject: ClassSubjectItem): void => {
    setEditingSubject(subject);
    setSubjectDialogOpen(true);
  };

  const openAddAnnouncement = (): void => {
    setEditingAnnouncement(null);
    setAnnouncementDialogOpen(true);
  };

  const openEditAnnouncement = (announcement: ClassAnnouncementItem): void => {
    setEditingAnnouncement(announcement);
    setAnnouncementDialogOpen(true);
  };

  const openAddNote = (): void => {
    setEditingNoteId(null);
    setNoteDialogOpen(true);
  };

  const openEditNote = (noteId: string): void => {
    setEditingNoteId(noteId);
    setNoteDialogOpen(true);
  };

  const handleLeave = async (): Promise<void> => {
    await leaveClass.mutateAsync(classItem.id);
    router.push('/turmas');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/turmas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Turmas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
            style={{ backgroundColor: `${classItem.color}1f`, color: classItem.color }}
            aria-hidden
          >
            {subjectInitials(classItem.name)}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{classItem.name}</h1>
              <Badge variant="outline">{defaultSemesterName(classItem)}</Badge>
              <Badge variant="outline">{classItem.period}º período</Badge>
              {isOwner && <Badge variant="outline">{CLASS_ROLE_LABELS.OWNER}</Badge>}
              {isArchived && <Badge variant="secondary">Arquivada</Badge>}
            </div>

            {classItem.description && (
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                {classItem.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {isOwner ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isArchived}
                onClick={() => setFinishSemesterOpen(true)}
              >
                <FlagTriangleRight className="size-4" aria-hidden />
                <span className="hidden sm:inline">Finalizar semestre</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isArchived}
                onClick={() => setPublishOpen(true)}
              >
                <Send className="size-4" aria-hidden />
                Publicar
              </Button>
              <Button size="sm" disabled={isArchived} onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" aria-hidden />
                Convidar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)}>
              <LogOut className="size-4" aria-hidden />
              Sair da turma
            </Button>
          )}
        </div>
      </div>

      {isArchived && (
        <Card className="flex items-center gap-3 p-4">
          <ShieldAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-sm text-muted-foreground">
            Esta turma está arquivada: sem convites, entradas ou publicações novas. O que já existe
            continua acessível.
          </p>
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={unarchiveClass.isPending}
              onClick={() => unarchiveClass.mutate(classItem.id)}
            >
              <ArchiveRestore className="size-4" aria-hidden />
              Desarquivar
            </Button>
          )}
        </Card>
      )}

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral" aria-label="Visão geral">
            <Users aria-hidden />
            <span className="hidden sm:inline">Visão geral</span>
          </TabsTrigger>
          <TabsTrigger value="mural" aria-label="Mural">
            <Megaphone aria-hidden />
            <span className="hidden sm:inline">Mural</span>
          </TabsTrigger>
          <TabsTrigger value="disciplinas" aria-label="Disciplinas">
            <GraduationCap aria-hidden />
            <span className="hidden sm:inline">Disciplinas</span>
          </TabsTrigger>
          <TabsTrigger value="materiais" aria-label="Materiais">
            <FileStack aria-hidden />
            <span className="hidden sm:inline">Materiais</span>
          </TabsTrigger>
          <TabsTrigger value="membros" aria-label="Membros">
            <Crown aria-hidden />
            <span className="hidden sm:inline">Membros</span>
          </TabsTrigger>
          <TabsTrigger value="historico" aria-label="Histórico">
            <History aria-hidden />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Membros</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{classItem.memberCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Disciplinas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {classItem.subjects.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Criada em</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatDate(classItem.createdAt)}
              </p>
            </Card>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Próximos 7 dias</p>

              {!upcomingPosts ? (
                <Skeleton className="h-16 w-full" />
              ) : upcomingPosts.length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Nada publicado para os próximos dias.
                  </p>
                </Card>
              ) : (
                <Card className="p-1">
                  <ul className="divide-y">
                    {upcomingPosts.map((post) => (
                      <ClassPostRow key={post.id} post={post} />
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Avisos fixados</p>

              {!announcements ? (
                <Skeleton className="h-16 w-full" />
              ) : pinnedAnnouncements.length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Nenhum aviso fixado.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {pinnedAnnouncements.map((announcement) => (
                    <Card key={announcement.id} className="flex items-start gap-3 p-3">
                      <Pin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{announcement.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {announcement.content}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Publicações</p>

            {!posts ? (
              <Skeleton className="h-16 w-full" />
            ) : posts.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Send}
                  title="Nenhuma publicação ainda"
                  description={
                    isOwner
                      ? 'Publique uma atividade, prova ou evento para todos os membros.'
                      : 'O dono ainda não publicou nada nesta turma.'
                  }
                  action={
                    isOwner && (
                      <Button variant="accent" size="sm" onClick={() => setPublishOpen(true)}>
                        <Send className="size-4" aria-hidden />
                        Publicar
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {POST_KIND_SECTIONS.map(({ kind, label }) => {
                  const items = posts.filter((post) => post.kind === kind);

                  if (items.length === 0) return null;

                  return (
                    <div key={kind}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {label} · {items.length}
                      </p>
                      <Card className="p-1">
                        <ul className="divide-y">
                          {items.map((post) => (
                            <ClassPostRow
                              key={post.id}
                              post={post}
                              onRemove={
                                isOwner
                                  ? (target) => void removePost.mutateAsync(target.id)
                                  : undefined
                              }
                            />
                          ))}
                        </ul>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mural" className="mt-4 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Avisos</p>
              {isOwner && !isArchived && (
                <Button size="sm" variant="outline" onClick={openAddAnnouncement}>
                  <Plus className="size-4" aria-hidden />
                  Publicar aviso
                </Button>
              )}
            </div>

            {!announcements ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : announcements.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Megaphone}
                  title="Nenhum aviso ainda"
                  description={
                    isOwner
                      ? 'Publique um aviso para notificar todo mundo na turma.'
                      : 'O dono ainda não publicou nenhum aviso.'
                  }
                  action={
                    isOwner &&
                    !isArchived && (
                      <Button variant="accent" size="sm" onClick={openAddAnnouncement}>
                        <Plus className="size-4" aria-hidden />
                        Publicar aviso
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {announcements.map((announcement) => (
                  <Card key={announcement.id} className="p-3">
                    <div className="flex items-start gap-3">
                      {announcement.pinned && (
                        <Pin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{announcement.title}</p>
                        <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">
                          {announcement.content}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {announcement.createdBy.name} · {formatRelative(announcement.createdAt)}
                        </p>
                      </div>
                      {isOwner && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() => openEditAnnouncement(announcement)}
                            aria-label={`Editar ${announcement.title}`}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() => void removeAnnouncement.mutateAsync(announcement.id)}
                            aria-label={`Excluir ${announcement.title}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Anotações</p>
              {isOwner && !isArchived && (
                <Button size="sm" variant="outline" onClick={openAddNote}>
                  <Plus className="size-4" aria-hidden />
                  Nova anotação
                </Button>
              )}
            </div>

            {!notes ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notes.length === 0 ? (
              <Card>
                <EmptyState
                  icon={FileText}
                  title="Nenhuma anotação ainda"
                  description={
                    isOwner
                      ? 'Crie uma anotação duradoura, visível para todo mundo na turma.'
                      : 'O dono ainda não criou nenhuma anotação.'
                  }
                  action={
                    isOwner &&
                    !isArchived && (
                      <Button variant="accent" size="sm" onClick={openAddNote}>
                        <Plus className="size-4" aria-hidden />
                        Nova anotação
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <Card
                    key={note.id}
                    className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent/40"
                    onClick={() => (isOwner ? openEditNote(note.id) : undefined)}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {note.createdBy.name} · atualizado {formatRelative(note.updatedAt)}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeNote.mutateAsync(note.id);
                        }}
                        aria-label={`Excluir ${note.title}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="disciplinas" className="mt-4 space-y-4">
          {isOwner && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openAddSubject}>
                <Plus className="size-4" aria-hidden />
                Adicionar disciplina
              </Button>
            </div>
          )}

          {classItem.subjects.length === 0 ? (
            <Card>
              <EmptyState
                icon={GraduationCap}
                title="Nenhuma disciplina ainda"
                description={
                  isOwner
                    ? 'Adicione disciplinas para que novos membros já entrem com elas montadas.'
                    : 'O dono ainda não adicionou disciplinas a esta turma.'
                }
                action={
                  isOwner && (
                    <Button variant="accent" size="sm" onClick={openAddSubject}>
                      <Plus className="size-4" aria-hidden />
                      Adicionar disciplina
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {classItem.subjects.map((subject) => (
                <Card key={subject.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                      style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
                      aria-hidden
                    >
                      {subjectInitials(subject.name, subject.code)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{subject.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {subject.teacherName ?? 'Sem professor'}
                        {subject.credits ? ` · ${subject.credits} créditos` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {subject.linkedMemberCount}{' '}
                        {subject.linkedMemberCount === 1
                          ? 'membro vinculado'
                          : 'membros vinculados'}
                      </p>
                    </div>

                    {isOwner && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => openEditSubject(subject)}
                          aria-label={`Editar ${subject.name}`}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => setRemovingSubject(subject)}
                          aria-label={`Remover ${subject.name}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="materiais" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="min-w-0 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Arquivos da turma</p>
                <FileStack className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {materialSummary?.totalFiles ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBytes(materialSummary?.totalBytes ?? 0)} · {materialSummary?.totalLinks ?? 0}{' '}
                link(s)
              </p>
            </Card>

            <Card className="min-w-0 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Armazenamento</p>
                <HardDrive className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatBytes(materialSummary?.totalBytes ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                contabilizado pela turma, não por quem enviou
              </p>
            </Card>
          </div>

          {!isArchived && <ClassMaterialUploadDropzone classId={id} />}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={isArchived}
              onClick={() => setMaterialLinkOpen(true)}
            >
              <Link2 className="size-4" aria-hidden />
              Adicionar link
            </Button>
          </div>

          {!materials ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : materials.length === 0 ? (
            <Card>
              <EmptyState
                icon={FileStack}
                title="Nenhum material ainda"
                description="Arraste um arquivo para a área acima ou salve um link para começar. Qualquer membro pode publicar."
              />
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {materials.map((material) => (
                <ClassMaterialCard
                  key={material.id}
                  material={material}
                  classId={id}
                  canDelete={isOwner || material.uploadedBy.id === user?.id}
                  onDelete={setRemovingMaterial}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="membros" className="mt-4 space-y-6">
          {!members ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.id} className="flex items-center gap-3 p-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.user.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  </div>

                  <Badge variant={member.role === 'OWNER' ? 'default' : 'outline'}>
                    {CLASS_ROLE_LABELS[member.role]}
                  </Badge>
                </Card>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="space-y-3 border-t pt-6">
              <p className="text-sm font-medium">Gestão da turma</p>

              <ClassHealthPanel classId={id} />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={transferCandidates.length === 0}
                  onClick={() => setTransferOpen(true)}
                >
                  <UserCog className="size-4" aria-hidden />
                  Transferir propriedade
                </Button>

                {isArchived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unarchiveClass.isPending}
                    onClick={() => unarchiveClass.mutate(classItem.id)}
                  >
                    <ArchiveRestore className="size-4" aria-hidden />
                    Desarquivar turma
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setArchiveConfirmOpen(true)}>
                    <Archive className="size-4" aria-hidden />
                    Arquivar turma
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-6">
          {!history ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : history.cycles.length === 0 ? (
            <Card>
              <EmptyState
                icon={History}
                title="Nenhum ciclo anterior"
                description="Quando o dono finalizar um semestre, o conteúdo do ciclo atual aparece aqui - somente leitura."
              />
            </Card>
          ) : (
            <div className="space-y-6">
              {history.cycles.map((cycle) => (
                <div key={cycle.semesterId}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm font-semibold">{cycle.semesterName}</p>
                    <Badge variant="outline">{cycle.period}º período</Badge>
                  </div>

                  {cycle.subjects.length > 0 && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      {cycle.subjects.map((subject) => (
                        <Card key={subject.id} className="flex items-center gap-2.5 p-3">
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold"
                            style={{ backgroundColor: `${subject.color}1f`, color: subject.color }}
                            aria-hidden
                          >
                            {subjectInitials(subject.name, subject.code)}
                          </span>
                          <p className="truncate text-sm">{subject.name}</p>
                        </Card>
                      ))}
                    </div>
                  )}

                  {cycle.posts.length > 0 && (
                    <Card className="p-1">
                      <ul className="divide-y">
                        {cycle.posts.map((post) => (
                          <li key={post.id} className="flex items-center gap-3 px-2 py-2 text-sm">
                            <span
                              className="h-6 w-1 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  post.classSubject?.color ?? 'var(--muted-foreground)',
                              }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate">{post.title}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {post.copyCount} {post.copyCount === 1 ? 'cópia' : 'cópias'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClassInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} classId={classItem.id} />

      <ClassFormDialog open={editOpen} onOpenChange={setEditOpen} classItem={classItem} />

      <FinishSemesterDialog
        classId={classItem.id}
        open={finishSemesterOpen}
        onOpenChange={setFinishSemesterOpen}
      />

      <ClassSubjectDialog
        open={subjectDialogOpen}
        onOpenChange={setSubjectDialogOpen}
        classId={classItem.id}
        subject={editingSubject}
      />

      <ClassPostFormDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        classId={classItem.id}
        subjects={classItem.subjects}
      />

      <ClassAnnouncementDialog
        open={announcementDialogOpen}
        onOpenChange={setAnnouncementDialogOpen}
        classId={classItem.id}
        announcement={editingAnnouncement}
      />

      <ClassNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        classId={classItem.id}
        noteId={editingNoteId}
      />

      <ClassMaterialLinkDialog
        open={materialLinkOpen}
        onOpenChange={setMaterialLinkOpen}
        classId={classItem.id}
      />

      <ClassTransferOwnerDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        classId={classItem.id}
        candidates={transferCandidates}
      />

      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar &quot;{classItem.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Convites, entrada de novos membros e publicações novas (posts, avisos, anotações,
              materiais) ficam bloqueados. Nada é apagado, e você pode desarquivar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await archiveClass.mutateAsync(classItem.id);
                setArchiveConfirmOpen(false);
              }}
            >
              Arquivar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removingMaterial !== null}
        onOpenChange={(open) => !open && setRemovingMaterial(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{removingMaterial?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMaterial?.source === 'LINK'
                ? 'O link será removido da turma. A página de destino não é afetada.'
                : 'O arquivo será apagado definitivamente do servidor. Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemovingMaterial(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!removingMaterial) return;
                await removeMaterial.mutateAsync(removingMaterial.id);
                setRemovingMaterial(null);
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removingSubject !== null}
        onOpenChange={(open) => !open && setRemovingSubject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover &quot;{removingSubject?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina sai da turma. Quem já a tem vinculada mantém a própria disciplina e notas
              - nada é apagado do lado do membro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemovingSubject(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!removingSubject) return;
                await removeSubject.mutateAsync({
                  classId: classItem.id,
                  subjectId: removingSubject.id,
                });
                setRemovingSubject(null);
              }}
            >
              Remover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de &quot;{classItem.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas disciplinas, notas e atividades continuam com você. Você só deixa de ver
              publicações e avisos futuros desta turma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleLeave()}>
              Sair da turma
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
