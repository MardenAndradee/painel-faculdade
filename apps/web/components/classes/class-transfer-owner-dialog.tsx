'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClassMemberItem } from '@painel/shared';
import { useTransferClassOwner } from '@/hooks/use-classes';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClassTransferOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  /** Membros ativos, exceto o próprio dono. */
  candidates: ClassMemberItem[];
}

/** Passa a propriedade da turma para outro membro ativo (Etapa 24). */
export function ClassTransferOwnerDialog({
  open,
  onOpenChange,
  classId,
  candidates,
}: ClassTransferOwnerDialogProps) {
  const [newOwnerUserId, setNewOwnerUserId] = useState<string>('');
  const transferOwner = useTransferClassOwner();

  const handleConfirm = async (): Promise<void> => {
    if (!newOwnerUserId) return;

    try {
      await transferOwner.mutateAsync({ classId, data: { newOwnerUserId } });
      setNewOwnerUserId('');
      onOpenChange(false);
    } catch {
      // O toast de erro já é disparado pelo hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir propriedade</DialogTitle>
          <DialogDescription>
            Você vira membro comum; a pessoa escolhida passa a gerenciar a turma - convites,
            disciplinas, publicações e exclusões.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há outro membro ativo para receber a propriedade.
          </p>
        ) : (
          <Select value={newOwnerUserId} onValueChange={setNewOwnerUserId}>
            <SelectTrigger aria-label="Novo dono">
              <SelectValue placeholder="Escolha um membro" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((member) => (
                <SelectItem key={member.user.id} value={member.user.id}>
                  {member.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={!newOwnerUserId || transferOwner.isPending}
            onClick={() => void handleConfirm()}
          >
            {transferOwner.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
