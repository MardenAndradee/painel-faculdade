'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowLeft,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { useNote, useUpdateNote } from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  noteId: string;
  subjectId: string;
  /** Chamado quando a nota nao e encontrada (excluida direto ou por cascata da pasta). */
  onMissing: () => void;
  /** Volta para a lista. So aparece no celular, onde lista e editor nao cabem lado a lado. */
  onBack: () => void;
}

const SAVE_DELAY_MS = 800;

/** Classes do corpo editavel: espacamento equivalente ao plugin de typography, sem a dependencia. */
const EDITOR_CONTENT_CLASS =
  'prose-notes min-h-[50dvh] px-6 py-4 text-sm focus:outline-none ' +
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold ' +
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold ' +
  '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold ' +
  '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground';

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
      className={cn('size-8', active && 'bg-accent text-accent-foreground')}
      // Sem isto o clique tira o foco do editor antes do comando rodar, e o
      // toggle se aplica a lugar nenhum.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <ToolbarButton
        icon={Bold}
        label="Negrito (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Itálico (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Tachado"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        icon={Heading1}
        label="Título 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={Heading2}
        label="Título 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label="Título 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

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
      <ToolbarButton
        icon={Quote}
        label="Citação"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        icon={Undo2}
        label="Desfazer (Ctrl+Z)"
        active={false}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Refazer (Ctrl+Shift+Z)"
        active={false}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

/**
 * Editor de uma nota: titulo + corpo em texto rico (Tiptap), com autosave.
 *
 * O salvamento so acontece 800ms apos a ultima edicao (titulo OU conteudo),
 * para nao disparar um PATCH a cada tecla. `titleRef` guarda o titulo mais
 * recente para o timer, que roda fora do ciclo de render do React.
 */
export function NoteEditor({ noteId, subjectId, onMissing, onBack }: NoteEditorProps) {
  const { data: note, isLoading, isError } = useNote(noteId);
  const updateNote = useUpdateNote(subjectId);

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const titleRef = useRef(title);
  titleRef.current = title;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedNoteId = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    editorProps: {
      attributes: { class: EDITOR_CONTENT_CLASS },
    },
    onUpdate: () => scheduleSave(),
  });

  function scheduleSave(): void {
    setStatus('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      if (!editor) return;

      updateNote.mutate(
        {
          id: noteId,
          data: {
            title: titleRef.current || 'Sem título',
            content: editor.getJSON() as unknown as Record<string, unknown>,
          },
        },
        { onSuccess: () => setStatus('saved') },
      );
    }, SAVE_DELAY_MS);
  }

  // So carrega o conteudo quando a nota muda: sobrescrever de novo a cada
  // refetch apagaria o que o usuario esta digitando.
  useEffect(() => {
    if (!note || !editor || loadedNoteId.current === note.id) return;

    editor.commands.setContent(note.content as unknown as JSONContent);
    setTitle(note.title);
    setStatus('idle');
    loadedNoteId.current = note.id;
  }, [note, editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isError) onMissing();
  }, [isError, onMissing]);

  if (isError) return null;

  if (isLoading || !note || !editor) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="sr-only">Voltar para a lista</span>
        </Button>

        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            scheduleSave();
          }}
          placeholder="Sem título"
          className="w-full min-w-0 border-none bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
        />

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {status === 'saving' && (
            <>
              <Spinner className="size-3" label="Salvando" />
              Salvando
            </>
          )}
          {status === 'saved' && 'Salvo'}
        </span>
      </div>

      <Toolbar editor={editor} />

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
