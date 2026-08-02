'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { WEEKDAY_LABELS, type AvailabilityWindow } from '@painel/shared';
import { useSaveAvailability } from '@/hooks/use-study-plan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  windows: AvailabilityWindow[];
}

/** Janela em edição, com os horários no formato "HH:MM" dos inputs. */
interface DraftWindow {
  dayOfWeek: number;
  start: string;
  end: string;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
}

/**
 * Editor da disponibilidade semanal.
 *
 * A grade inteira e enviada de uma vez, nao janela a janela: o usuario edita
 * varias linhas e salva uma vez so, e assim a tela nunca fica num estado
 * parcial se uma das chamadas falhasse no meio.
 */
export function AvailabilityDialog({ open, onOpenChange, windows }: AvailabilityDialogProps) {
  const [draft, setDraft] = useState<DraftWindow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const saveAvailability = useSaveAvailability();

  useEffect(() => {
    if (!open) return;

    setError(null);
    setDraft(
      windows.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        start: minutesToTime(window.startMinute),
        end: minutesToTime(window.endMinute),
      })),
    );
  }, [open, windows]);

  const addWindow = (dayOfWeek: number): void => {
    setDraft((current) => [...current, { dayOfWeek, start: '19:00', end: '21:00' }]);
  };

  const updateWindow = (index: number, patch: Partial<DraftWindow>): void => {
    setDraft((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeWindow = (index: number): void => {
    setDraft((current) => current.filter((_, i) => i !== index));
  };

  const handleSave = async (): Promise<void> => {
    const converted = draft.map((item) => ({
      dayOfWeek: item.dayOfWeek,
      startMinute: timeToMinutes(item.start),
      endMinute: timeToMinutes(item.end),
    }));

    // Valida antes de enviar: o usuário corrige na hora, sem viagem ao servidor.
    const invalid = converted.find((window) => window.endMinute <= window.startMinute);

    if (invalid) {
      setError(`Em ${WEEKDAY_LABELS[invalid.dayOfWeek]}, o fim precisa ser depois do início.`);
      return;
    }

    try {
      await saveAvailability.mutateAsync({ windows: converted });
      onOpenChange(false);
    } catch {
      // O toast de erro vem do hook — inclusive o de janelas sobrepostas, que
      // só o servidor tem contexto para detectar com certeza.
    }
  };

  const totalMinutes = draft.reduce(
    (total, item) => total + Math.max(0, timeToMinutes(item.end) - timeToMinutes(item.start)),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quando você consegue estudar?</DialogTitle>
          <DialogDescription>
            O gerador só marca blocos dentro destas janelas. Um dia pode ter mais de uma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {WEEKDAY_LABELS.map((label, dayOfWeek) => {
            const dayWindows = draft
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item.dayOfWeek === dayOfWeek);

            return (
              <div key={label} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{label}</p>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addWindow(dayOfWeek)}
                    aria-label={`Adicionar janela em ${label}`}
                  >
                    <Plus className="size-4" aria-hidden />
                    Janela
                  </Button>
                </div>

                {dayWindows.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Sem disponibilidade</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {dayWindows.map(({ item, index }, position) => {
                      /* O rotulo numera quando o dia tem mais de uma janela:
                         com dois campos "Início da janela de Segunda", quem usa
                         leitor de tela nao consegue distinguir um do outro. */
                      const suffix = dayWindows.length > 1 ? ` ${position + 1}` : '';

                      return (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            value={item.start}
                            onChange={(event) => updateWindow(index, { start: event.target.value })}
                            aria-label={`Início da janela${suffix} de ${label}`}
                            className="w-32"
                          />

                          <span className="text-sm text-muted-foreground">até</span>

                          <Input
                            type="time"
                            value={item.end}
                            onChange={(event) => updateWindow(index, { end: event.target.value })}
                            aria-label={`Fim da janela${suffix} de ${label}`}
                            className="w-32"
                          />

                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => removeWindow(index)}
                            aria-label={`Remover janela${suffix} de ${label}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="items-center justify-between sm:justify-between">
          <Badge variant="secondary">
            {Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 && ` ${totalMinutes % 60}min`}{' '}
            por semana
          </Badge>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button onClick={() => void handleSave()} disabled={saveAvailability.isPending}>
              {saveAvailability.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Salvar disponibilidade
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
