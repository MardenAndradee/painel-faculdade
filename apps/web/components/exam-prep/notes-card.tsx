'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Quote } from 'lucide-react';
import { useUpdateExamPrepNotes } from '@/hooks/use-exam-preps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface NotesCardProps {
  examPrepId: string;
  notes: Record<string, unknown>;
}

const SAVE_DELAY_MS = 800;

const EDITOR_CONTENT_CLASS =
  'prose-notes min-h-[16dvh] rounded-md border px-3 py-2 text-sm focus:outline-none ' +
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground';

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
      // Sem isto o clique tira o foco do editor antes do comando rodar.
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
 * Anotações do Plano de Estudos (Etapa 6) - reaproveita o mesmo Tiptap de
 * `NoteEditor`, sem editor novo. Um blob só por plano, sem título e sem
 * pastas: é anotação de UMA prova, não um acervo pra organizar.
 */
export function NotesCard({ examPrepId, notes }: NotesCardProps) {
  const updateNotes = useUpdateExamPrepNotes(examPrepId);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const hasLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    editorProps: { attributes: { class: EDITOR_CONTENT_CLASS } },
    onUpdate: () => {
      setStatus('saving');

      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(() => {
        updateNotes.mutate(
          { notes: editor?.getJSON() as unknown as Record<string, unknown> },
          { onSuccess: () => setStatus('saved') },
        );
      }, SAVE_DELAY_MS);
    },
  });

  // Carrega o conteudo uma unica vez: o plano nao troca de `examPrepId`
  // dentro da mesma pagina, e reaplicar a cada refetch apagaria o que o
  // aluno esta digitando (mesmo cuidado do `NoteEditor`).
  useEffect(() => {
    if (!editor || hasLoaded.current) return;

    editor.commands.setContent(notes as unknown as JSONContent);
    hasLoaded.current = true;
  }, [editor, notes]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <Card className="space-y-2 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Anotações</h2>

        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {status === 'saving' && (
            <>
              <Spinner className="size-3" label="Salvando" />
              Salvando
            </>
          )}
          {status === 'saved' && 'Salvo'}
        </span>
      </div>

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

            <span className="mx-1 h-4 w-px bg-border" aria-hidden />

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
            <ToolbarButton
              icon={Quote}
              label="Citação"
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
          </div>

          <EditorContent editor={editor} />
        </div>
      )}
    </Card>
  );
}
