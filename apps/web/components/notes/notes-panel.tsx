'use client';

import { useState } from 'react';
import { FilePlus, FolderPlus, NotebookText } from 'lucide-react';
import type { NoteFolderListItem, NoteListItem } from '@painel/shared';
import {
  useCreateNote,
  useDeleteNote,
  useDeleteNoteFolder,
  useNoteFolders,
  useNotes,
} from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NotesTree } from './notes-tree';
import { NoteFolderDialog } from './note-folder-dialog';
import { NoteEditor } from './note-editor';

interface NotesPanelProps {
  subjectId: string;
}

type DeleteTarget =
  { kind: 'folder'; folder: NoteFolderListItem } | { kind: 'note'; note: NoteListItem };

/** Aba de anotacoes da disciplina: pastas e notas de texto rico, ao estilo Obsidian. */
export function NotesPanel({ subjectId }: NotesPanelProps) {
  const { data: folders, isLoading: isLoadingFolders } = useNoteFolders(subjectId);
  const { data: notes, isLoading: isLoadingNotes } = useNotes(subjectId);

  const createNote = useCreateNote(subjectId);
  const deleteNote = useDeleteNote(subjectId);
  const deleteFolder = useDeleteNoteFolder(subjectId);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<{
    parentId: string | null;
    folder: NoteFolderListItem | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  async function handleNewNote(folderId: string | null): Promise<void> {
    const note = await createNote.mutateAsync({
      title: 'Sem título',
      subjectId,
      folderId,
    });

    setSelectedNoteId(note.id);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return;

    if (deleteTarget.kind === 'note') {
      await deleteNote.mutateAsync(deleteTarget.note.id);
      if (selectedNoteId === deleteTarget.note.id) setSelectedNoteId(null);
    } else {
      // Notas dentro da pasta (e de suas subpastas) somem em cascata no banco.
      // Se a nota aberta era uma delas, `NoteEditor` avisa via `onMissing`
      // quando a busca voltar 404 - mais simples e confiavel do que percorrer
      // a arvore de pastas aqui so para descobrir se ela era descendente.
      await deleteFolder.mutateAsync(deleteTarget.folder.id);
    }

    setDeleteTarget(null);
  }

  const isLoading = isLoadingFolders || isLoadingNotes;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex h-[min(70dvh,700px)] min-h-[420px]">
        <div className="flex w-64 shrink-0 flex-col border-r">
          <div className="flex items-center gap-1 border-b p-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start"
              onClick={() => void handleNewNote(null)}
            >
              <FilePlus aria-hidden />
              Nota
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start"
              onClick={() => setFolderDialog({ parentId: null, folder: null })}
            >
              <FolderPlus aria-hidden />
              Pasta
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/5" />
              </div>
            ) : (
              <NotesTree
                folders={folders ?? []}
                notes={notes ?? []}
                selectedNoteId={selectedNoteId}
                onSelectNote={setSelectedNoteId}
                onNewFolder={(parentId) => setFolderDialog({ parentId, folder: null })}
                onRenameFolder={(folder) => setFolderDialog({ parentId: null, folder })}
                onDeleteFolder={(folder) => setDeleteTarget({ kind: 'folder', folder })}
                onNewNote={(folderId) => void handleNewNote(folderId)}
                onDeleteNote={(note) => setDeleteTarget({ kind: 'note', note })}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {selectedNoteId ? (
            <NoteEditor
              key={selectedNoteId}
              noteId={selectedNoteId}
              subjectId={subjectId}
              onMissing={() => setSelectedNoteId(null)}
            />
          ) : (
            <EmptyState
              icon={NotebookText}
              title="Nenhuma nota selecionada"
              description="Crie uma nota ou escolha uma na lista ao lado."
              className="h-full justify-center"
            />
          )}
        </div>
      </div>

      {folderDialog && (
        <NoteFolderDialog
          open={Boolean(folderDialog)}
          onOpenChange={(open) => !open && setFolderDialog(null)}
          subjectId={subjectId}
          parentId={folderDialog.parentId}
          folder={folderDialog.folder}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === 'folder' ? 'Excluir pasta' : 'Excluir nota'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'folder'
                ? `"${deleteTarget.folder.name}" e tudo dentro dela (subpastas e notas) será excluído permanentemente.`
                : `"${deleteTarget?.kind === 'note' ? deleteTarget.note.title : ''}" será excluída permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
