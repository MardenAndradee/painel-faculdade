'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { NoteFolderListItem, NoteListItem } from '@painel/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface NotesTreeProps {
  folders: NoteFolderListItem[];
  notes: NoteListItem[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: NoteFolderListItem) => void;
  onDeleteFolder: (folder: NoteFolderListItem) => void;
  onNewNote: (folderId: string | null) => void;
  onDeleteNote: (note: NoteListItem) => void;
}

/**
 * Arvore de pastas e notas de uma disciplina.
 *
 * Recebe as listas planas (como a API devolve) e monta os niveis sob demanda
 * a cada render - a quantidade de pastas de uma disciplina e pequena o
 * suficiente para que reconstruir a arvore nao pese, e evita manter um
 * segundo estado (a arvore) sincronizado com o cache do React Query.
 */
export function NotesTree({
  folders,
  notes,
  selectedNoteId,
  onSelectNote,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onNewNote,
  onDeleteNote,
}: NotesTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string): void {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function renderLevel(parentId: string | null, depth: number): React.ReactNode {
    const childFolders = folders.filter((folder) => folder.parentId === parentId);
    const childNotes = notes.filter((note) => note.folderId === parentId);

    if (childFolders.length === 0 && childNotes.length === 0 && depth === 0) {
      return (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
          Nenhuma pasta ou nota ainda.
        </p>
      );
    }

    return (
      <>
        {childFolders.map((folder) => {
          const isOpen = expanded.has(folder.id);

          return (
            <div key={folder.id}>
              <div
                className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent"
                style={{ paddingLeft: `${depth * 16 + 4}px` }}
              >
                <button
                  type="button"
                  onClick={() => toggle(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
                >
                  {isOpen ? (
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {isOpen ? (
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="truncate">{folder.name}</span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5" aria-hidden />
                      <span className="sr-only">Ações da pasta {folder.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => onNewNote(folder.id)}>
                      <FilePlus aria-hidden />
                      Nova nota aqui
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onNewFolder(folder.id)}>
                      <FolderPlus aria-hidden />
                      Nova subpasta
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRenameFolder(folder)}>
                      <Pencil aria-hidden />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDeleteFolder(folder)}>
                      <Trash2 aria-hidden />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {isOpen && renderLevel(folder.id, depth + 1)}
            </div>
          );
        })}

        {childNotes.map((note) => (
          <div
            key={note.id}
            className={cn(
              'group flex items-center gap-1 rounded-md pr-1 hover:bg-accent',
              selectedNoteId === note.id && 'bg-accent',
            )}
            style={{ paddingLeft: `${depth * 16 + 22}px` }}
          >
            <button
              type="button"
              onClick={() => onSelectNote(note.id)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{note.title}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" aria-hidden />
                  <span className="sr-only">Ações da nota {note.title}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem variant="destructive" onSelect={() => onDeleteNote(note)}>
                  <Trash2 aria-hidden />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </>
    );
  }

  return <div className="space-y-0.5">{renderLevel(null, 0)}</div>;
}
