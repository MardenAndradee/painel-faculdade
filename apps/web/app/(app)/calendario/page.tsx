'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  ChevronLeft,
  CalendarSync,
  ChevronRight,
  ClipboardList,
  ListChecks,
  MapPin,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  CALENDAR_VIEW_LABELS,
  CALENDAR_VIEWS,
  type CalendarItem,
  type CalendarView,
} from '@painel/shared';
import { toast } from 'sonner';
import { useAgenda } from '@/hooks/use-calendar';
import { calendarService } from '@/services/calendar.service';
import { getRange, shiftReference } from '@/lib/calendar-range';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { DayView, MonthView, WeekView } from '@/components/calendar/calendar-views';
import { EventFormDialog, type EditingEvent } from '@/components/calendar/event-form-dialog';
import { cn } from '@/lib/utils';

/** Rotulo do periodo exibido, conforme a visao. */
function periodLabel(view: CalendarView, reference: Date): string {
  if (view === 'dia') return format(reference, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (view === 'semana') {
    const { from, to } = getRange('semana', reference);
    const sameMonth = from.getMonth() === to.getMonth();

    return sameMonth
      ? `${format(from, 'd')} – ${format(to, "d 'de' MMMM", { locale: ptBR })}`
      : `${format(from, "d 'de' MMM", { locale: ptBR })} – ${format(to, "d 'de' MMM", { locale: ptBR })}`;
  }

  return format(reference, 'MMMM yyyy', { locale: ptBR });
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('mes');
  const [reference, setReference] = useState(() => new Date());
  const [includeCompleted, setIncludeCompleted] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const { from, to } = useMemo(() => getRange(view, reference), [view, reference]);
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAgenda(from, to, includeCompleted);

  /**
   * Abrir um item da agenda.
   *
   * Apenas eventos proprios sao editaveis aqui: provas e entregas tem suas
   * proprias telas, com campos que nao cabem num formulario de evento.
   */
  const handleSelectItem = async (item: CalendarItem): Promise<void> => {
    if (item.kind !== 'EVENT') return;

    // Evento importado e somente leitura: editar aqui seria trabalho perdido,
    // porque a proxima sincronizacao sobrescreveria a alteracao.
    if (item.source === 'GOOGLE_CALENDAR') {
      toast.info('Evento do Google Calendar', {
        description: 'Edite na sua agenda do Google — a alteração vem na próxima importação.',
      });
      return;
    }

    const detail = await calendarService.getEvent(item.id);

    setEditing({
      id: detail.id,
      title: detail.title,
      description: detail.description,
      location: detail.location,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      allDay: detail.allDay,
      subjectId: detail.subject?.id ?? null,
    });
    setDefaultDate(null);
    setFormOpen(true);
  };

  /** Clicar num dia: na visão de mês, abre esse dia; nas demais, cria evento. */
  const handleSelectDay = (day: Date): void => {
    if (view === 'mes') {
      setReference(day);
      setView('dia');
      return;
    }

    setEditing(null);
    setDefaultDate(day);
    setFormOpen(true);
  };

  const openCreate = (): void => {
    setEditing(null);
    setDefaultDate(view === 'dia' ? reference : null);
    setFormOpen(true);
  };

  const viewProps = {
    reference,
    items,
    onSelectItem: (item: CalendarItem) => void handleSelectItem(item),
    onSelectDay: handleSelectDay,
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Calendário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provas, entregas e seus compromissos no mesmo lugar.
          </p>
        </div>

        <Button onClick={openCreate} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo evento</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Navegação do período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setReference((current) => shiftReference(view, current, -1))}
            aria-label="Período anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setReference((current) => shiftReference(view, current, 1))}
            aria-label="Próximo período"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={() => setReference(new Date())}
          >
            Hoje
          </Button>

          <p className="ml-2 text-sm font-medium capitalize sm:text-base">
            {periodLabel(view, reference)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={includeCompleted ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setIncludeCompleted((current) => !current)}
            aria-pressed={includeCompleted}
          >
            Concluídas
          </Button>

          <div
            className="flex rounded-lg bg-muted p-0.5"
            role="tablist"
            aria-label="Modo de visualização"
          >
            {CALENDAR_VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  view === item
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {CALENDAR_VIEW_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      ) : isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar o calendário"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {view === 'mes' && <MonthView {...viewProps} />}
          {view === 'semana' && <WeekView {...viewProps} />}
          {view === 'dia' && <DayView {...viewProps} />}
        </div>
      )}

      {/* Legenda com os mesmos ícones da grade: cor sozinha não distingue os
          tipos, e listar só os nomes não ensinaria a associação. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="font-medium">Legenda:</span>

        <span className="inline-flex items-center gap-1.5">
          <ClipboardList className="size-3.5" aria-hidden />
          Prova
        </span>

        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="size-3.5" aria-hidden />
          Entrega
        </span>

        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden />
          Evento
        </span>

        <span className="inline-flex items-center gap-1.5">
          <CalendarSync className="size-3.5" aria-hidden />
          Google Calendar
        </span>

        <span className="hidden sm:inline">· A cor indica a disciplina</span>
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        defaultDate={defaultDate}
      />
    </div>
  );
}
