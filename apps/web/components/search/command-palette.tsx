'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  CalendarDays,
  ClipboardList,
  FileStack,
  GraduationCap,
  ListChecks,
  Loader2,
  Search,
  SearchX,
  type LucideIcon,
} from 'lucide-react';
import { SEARCH_KIND_LABELS, type SearchKind, type SearchResultItem } from '@painel/shared';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { searchResultHref } from '@/lib/entity-routes';
import { EmptyState } from '@/components/empty-state';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_ICONS: Record<SearchKind, LucideIcon> = {
  SUBJECT: GraduationCap,
  ASSIGNMENT: ListChecks,
  EXAM: ClipboardList,
  CALENDAR_EVENT: CalendarDays,
  ATTACHMENT: FileStack,
};

/**
 * Realce do trecho procurado.
 *
 * Feito por fatiamento de string, nunca por `innerHTML`: o termo vem do que a
 * pessoa digitou, e injetá-lo como HTML seria XSS a um passo de distância.
 */
function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;

  const index = text.toLocaleLowerCase('pt-BR').indexOf(term.toLocaleLowerCase('pt-BR'));

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-primary/20 text-inherit">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

/**
 * Paleta de comando (⌘K / Ctrl+K), da Etapa 19.
 *
 * Usa `cmdk` em vez de uma lista própria: navegação por teclado, foco e
 * `aria` de combobox são detalhes que dão muito errado quando reimplementados,
 * e a biblioteca é da mesma família do Radix que o projeto já usa em
 * `Select`/`Dialog`/`DropdownMenu`.
 *
 * A filtragem da biblioteca fica DESLIGADA (`shouldFilter={false}`): quem
 * filtra é o servidor, e deixar o `cmdk` refiltrar por conta esconderia
 * resultados legítimos que ele não considera parecidos o suficiente.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const { results, isLoading, term, isTooShort } = useGlobalSearch(input);

  // Cada abertura começa limpa: reaproveitar a busca anterior faria a paleta
  // abrir já cheia de resultados de outro assunto.
  useEffect(() => {
    if (!open) setInput('');
  }, [open]);

  const select = (item: SearchResultItem): void => {
    onOpenChange(false);
    router.push(searchResultHref(item));
  };

  const groups = results?.groups ?? [];
  const hasResults = groups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Buscar</DialogTitle>

        <Command shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-2 border-b px-4">
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}

            <Command.Input
              value={input}
              onValueChange={setInput}
              placeholder="Buscar disciplinas, atividades, provas..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
            {input.trim() === '' && (
              <EmptyState
                icon={Search}
                title="O que você procura?"
                description="Busque por disciplinas, atividades, provas, eventos e materiais."
              />
            )}

            {isTooShort && (
              <EmptyState
                icon={Search}
                title="Continue digitando"
                description="Pelo menos duas letras para começar a busca."
              />
            )}

            {!isTooShort && input.trim() !== '' && !isLoading && !hasResults && (
              <EmptyState
                icon={SearchX}
                title="Nada encontrado"
                description={`Nenhum resultado para "${input.trim()}".`}
              />
            )}

            {groups.map((group) => {
              const Icon = KIND_ICONS[group.kind];

              return (
                <Command.Group
                  key={group.kind}
                  heading={SEARCH_KIND_LABELS[group.kind]}
                  className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.key}
                      value={item.key}
                      onSelect={() => select(item)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-accent"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-[8px]"
                        style={
                          item.color
                            ? { backgroundColor: `${item.color}1f`, color: item.color }
                            : undefined
                        }
                      >
                        <Icon
                          className={item.color ? 'size-3.5' : 'size-3.5 text-muted-foreground'}
                          aria-hidden
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{highlight(item.title, term)}</span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          <div className="hidden items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span>
              <kbd className="rounded border px-1 font-sans">↑</kbd>{' '}
              <kbd className="rounded border px-1 font-sans">↓</kbd> navegar
            </span>
            <span>
              <kbd className="rounded border px-1 font-sans">Enter</kbd> abrir
            </span>
            <span>
              <kbd className="rounded border px-1 font-sans">Esc</kbd> fechar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
