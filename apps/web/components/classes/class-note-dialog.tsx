'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Loader2 } from 'lucide-react';
import { useClassNote, useCreateClassNote, useUpdateClassNote } from '@/hooks/use-class-notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ClassNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  /** Presente na edição; `null` na criação. */
  noteId: string | null;
}

const EDITOR_CONTENT_CLASS =
  'prose-notes min-h-[30vh] rounded-md border px-3 py-2 text-sm focus:outline-none ' +
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5';

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-7', active && 'bg-accent text-accent-foreground')}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

/**
 * Cria ou edita uma anotação do Mural: mesmo formato Tiptap de `Note`, mas
 * com UM autor só (o dono) - sem autosave contínuo, salva no envio do
 * formulário como as demais publicações da turma.
 */
export function ClassNoteDialog({ open, onOpenChange, classId, noteId }: ClassNoteDialogProps) {
  const isEditing = noteId !== null;
  const { data: note, isLoading } = useClassNote(classId, open ? noteId : null);
  const createNote = useCreateClassNote(classId);
  const updateNote = useUpdateClassNote(classId);

  const [title, setTitle] = useState('');
  const loadedNoteId = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    editorProps: { attributes: { class: EDITOR_CONTENT_CLASS } },
  });

  useEffect(() => {
    if (!open) {
      loadedNoteId.current = null;
      return;
    }

    if (!isEditing && loadedNoteId.current !== 'new') {
      setTitle('');
      editor?.commands.setContent({ type: 'doc', content: [] });
      loadedNoteId.current = 'new';
      return;
    }

    if (note && editor && loadedNoteId.current !== note.id) {
      setTitle(note.title);
      editor.commands.setContent(note.content as unknown as JSONContent);
      loadedNoteId.current = note.id;
    }
  }, [open, isEditing, note, editor]);

  const handleSubmit = async (): Promise<void> => {
    if (!editor || !title.trim()) return;

    setSubmitting(true);

    try {
      const content = editor.getJSON() as unknown as Record<string, unknown>;

      if (isEditing && noteId) {
        await updateNote.mutateAsync({ noteId, data: { title, content } });
      } else {
        await createNote.mutateAsync({ title, content });
      }

      onOpenChange(false);
    } catch {
      // O toast de erro já é disparado pelo hook.
    } finally {
      setSubmitting(false);
    }
  };

  const showSkeleton = isEditing && (isLoading || !note || !editor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar anotação' : 'Nova anotação'}</DialogTitle>
          <DialogDescription>Visível para todo membro da turma, sem notificação.</DialogDescription>
        </DialogHeader>

        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da anotação"
              autoFocus
            />

            {editor && (
              <div>
                <div className="mb-1.5 flex items-center gap-0.5 rounded-md border p-1">
                  <ToolbarButton
                    icon={Bold}
                    label="Negrito"
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  />
                  <ToolbarButton
                    icon={Italic}
                    label="Itálico"
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  />
                  <ToolbarButton
                    icon={Heading2}
                    label="Título"
                    active={editor.isActive('heading', { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  />
                  <ToolbarButton
                    icon={List}
                    label="Lista com marcadores"
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                  />
                  <ToolbarButton
                    icon={ListOrdered}
                    label="Lista numerada"
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  />
                </div>

                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={submitting || !title.trim() || showSkeleton}
            onClick={() => void handleSubmit()}
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
