'use client';

import { useState } from 'react';
import { Copy, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClassInviteCreated } from '@painel/shared';
import { useClassInvites, useCreateClassInvite, useRevokeClassInvite } from '@/hooks/use-classes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';

interface ClassInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
}

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error('Não foi possível copiar');
  }
}

/** QR gerado por um serviço público, a partir do link (sem dado sensível além dele mesmo). */
function qrCodeUrl(joinUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`;
}

export function ClassInviteDialog({ open, onOpenChange, classId }: ClassInviteDialogProps) {
  const { data: invites, isLoading } = useClassInvites(classId, open);
  const createInvite = useCreateClassInvite();
  const revokeInvite = useRevokeClassInvite();
  const [maxUses, setMaxUses] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [justCreated, setJustCreated] = useState<ClassInviteCreated | null>(null);

  const handleCreate = async (): Promise<void> => {
    try {
      const result = await createInvite.mutateAsync({
        classId,
        data: {
          maxUses: maxUses ? Number(maxUses) : undefined,
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
        },
      });
      setJustCreated(result);
      setMaxUses('');
      setExpiresInDays('');
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a turma</DialogTitle>
          <DialogDescription>
            Quem entrar com o link ou código ganha o semestre e as disciplinas montados
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        {justCreated ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <img
                src={qrCodeUrl(justCreated.joinUrl)}
                alt="QR code do convite"
                width={160}
                height={160}
                className="rounded-md bg-white p-2"
              />

              <div className="flex w-full items-center gap-2">
                <Input readOnly value={justCreated.joinUrl} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => void copy(justCreated.joinUrl, 'Link')}
                  aria-label="Copiar link"
                >
                  <Copy className="size-4" aria-hidden />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setJustCreated(null)}
            >
              <Plus className="size-4" aria-hidden />
              Criar outro convite
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Expira em (dias)">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    placeholder="Sem limite"
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(event.target.value)}
                  />
                )}
              </FormField>

              <FormField label="Máx. de usos">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    placeholder="Sem limite"
                    value={maxUses}
                    onChange={(event) => setMaxUses(event.target.value)}
                  />
                )}
              </FormField>
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={() => void handleCreate()}
              disabled={createInvite.isPending}
            >
              {createInvite.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              Gerar convite
            </Button>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Convites ativos
          </p>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !invites || invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite ativo.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {invite.useCount} {invite.useCount === 1 ? 'uso' : 'usos'}
                      {invite.maxUses ? ` de ${invite.maxUses}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {invite.expiresAt
                        ? `Expira em ${formatDate(invite.expiresAt)}`
                        : 'Sem expiração'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => void revokeInvite.mutateAsync({ classId, inviteId: invite.id })}
                    aria-label="Revogar convite"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
