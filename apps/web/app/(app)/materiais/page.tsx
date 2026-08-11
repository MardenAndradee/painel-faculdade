'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileStack,
  HardDrive,
  Link2,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  ATTACHMENT_SORT_FIELDS,
  ATTACHMENT_SORT_LABELS,
  ATTACHMENT_TYPE,
  ATTACHMENT_TYPE_LABELS,
  type AttachmentListItem,
  type AttachmentSortField,
  type AttachmentType,
} from '@painel/shared';
import { useAttachments, useAttachmentSummary, useDeleteAttachment } from '@/hooks/use-attachments';
import { useSubjects } from '@/hooks/use-subjects';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UploadDropzone } from '@/components/materials/upload-dropzone';
import { AttachmentCard } from '@/components/materials/attachment-card';
import { LinkFormDialog } from '@/components/materials/link-form-dialog';
import { AttachmentEditDialog } from '@/components/materials/attachment-edit-dialog';
import { AttachmentPreview } from '@/components/materials/attachment-preview';
import { useInitialSearchParam } from '@/hooks/use-initial-search-param';
import { SEARCH_PARAM } from '@/lib/entity-routes';
import { formatBytes } from '@/lib/format';

const ALL = 'all';
const PAGE_SIZE = 24;

export default function MaterialsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AttachmentType | typeof ALL>(ALL);

  // Chegada pela busca global (Etapa 19): `/materiais?busca=Slides aula 4`.
  const fromSearch = useInitialSearchParam(SEARCH_PARAM);

  useEffect(() => {
    if (fromSearch) setSearch(fromSearch);
  }, [fromSearch]);

  const [subjectId, setSubjectId] = useState<string>(ALL);
  const [sortBy, setSortBy] = useState<AttachmentSortField>('createdAt');
  const [page, setPage] = useState(1);

  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<AttachmentListItem | null>(null);
  const [previewing, setPreviewing] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState<AttachmentListItem | null>(null);

  const deleteAttachment = useDeleteAttachment();
  const { data: subjects } = useSubjects({ page: 1, perPage: 100 });
  const { data: summary } = useAttachmentSummary();

  const { data, isLoading, isError, error, refetch, isFetching } = useAttachments({
    page,
    perPage: PAGE_SIZE,
    search: search.trim() || undefined,
    type: type === ALL ? undefined : type,
    subjectId: subjectId === ALL ? undefined : subjectId,
    sortBy,
    // Nome cresce de A a Z; data e tamanho fazem mais sentido do maior para o
    // menor (mais recente primeiro, maior arquivo primeiro).
    order: sortBy === 'name' ? 'asc' : 'desc',
  });

  /** Qualquer mudança de filtro volta para a primeira página. */
  const resetPage = <T,>(setter: (value: T) => void) => {
    return (value: T): void => {
      setter(value);
      setPage(1);
    };
  };

  const attachments = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = search.trim() !== '' || type !== ALL || subjectId !== ALL;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Materiais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slides, PDFs, resumos e links reunidos por disciplina.
          </p>
        </div>

        <Button onClick={() => setLinkOpen(true)} className="shrink-0">
          <Link2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Adicionar link</span>
          <span className="sm:hidden">Link</span>
        </Button>
      </div>

      {/* Resumo do acervo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Arquivos</p>
            <FileStack className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary?.totalFiles ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">enviados por você</p>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Espaço usado</p>
            <HardDrive className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatBytes(summary?.totalBytes ?? 0)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">links não ocupam espaço</p>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Links</p>
            <Link2 className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary?.totalLinks ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">vídeos, artigos e pastas</p>
        </Card>
      </div>

      <UploadDropzone target={subjectId === ALL ? undefined : { subjectId }} />

      {subjectId !== ALL && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Os arquivos enviados agora serão vinculados a{' '}
          <span className="font-medium text-foreground">
            {subjects?.data.find((item) => item.id === subjectId)?.name}
          </span>
          .
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            placeholder="Buscar por nome ou disciplina"
            aria-label="Buscar materiais"
            className="pl-9"
          />
        </div>

        <Select value={subjectId} onValueChange={resetPage(setSubjectId)}>
          <SelectTrigger className="sm:w-52" aria-label="Filtrar por disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as disciplinas</SelectItem>
            {subjects?.data.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type}
          onValueChange={(value) => resetPage(setType)(value as AttachmentType | typeof ALL)}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {ATTACHMENT_TYPE.map((item) => (
              <SelectItem key={item} value={item}>
                {ATTACHMENT_TYPE_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as AttachmentSortField)}>
          <SelectTrigger className="sm:w-40" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTACHMENT_SORT_FIELDS.map((field) => (
              <SelectItem key={field} value={field}>
                {ATTACHMENT_SORT_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar os materiais"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : attachments.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileStack}
            title={hasFilters ? 'Nenhum material encontrado' : 'Nenhum material ainda'}
            description={
              hasFilters
                ? 'Ajuste a busca ou os filtros para ver outros materiais.'
                : 'Arraste um arquivo para a área acima ou salve um link para começar.'
            }
            action={
              hasFilters ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setType(ALL);
                    setSubjectId(ALL);
                    setPage(1);
                  }}
                >
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {meta?.total} {meta?.total === 1 ? 'material' : 'materiais'}
            </p>

            {isFetching && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onPreview={setPreviewing}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasPreviousPage}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>

              <Badge variant="secondary">
                {meta.page} de {meta.totalPages}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <LinkFormDialog open={linkOpen} onOpenChange={setLinkOpen} />

      <AttachmentEditDialog
        attachment={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <AttachmentPreview
        attachment={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.source === 'LINK'
                ? 'O link será removido da sua lista. A página de destino não é afetada.'
                : 'O arquivo será apagado definitivamente do servidor. Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>

            <Button
              variant="destructive"
              disabled={deleteAttachment.isPending}
              onClick={async () => {
                if (!deleting) return;

                await deleteAttachment.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              {deleteAttachment.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
