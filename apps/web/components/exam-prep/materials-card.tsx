'use client';

import { useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import type { ExamPrepMaterialItem } from '@painel/shared';
import { useAddExamPrepMaterial, useRemoveExamPrepMaterial } from '@/hooks/use-exam-preps';
import { TYPE_ICONS } from '@/components/materials/attachment-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MaterialPickerDialog } from './material-picker-dialog';

interface MaterialsCardProps {
  examPrepId: string;
  materials: ExamPrepMaterialItem[];
  suggestedMaterials: ExamPrepMaterialItem['attachment'][];
}

/**
 * Materiais do plano (Etapa 7): referências a `Attachment`s já existentes,
 * nunca cópias. Os que já apontam pra esta prova (`Attachment.examId`)
 * aparecem sugeridos, um clique pra confirmar - o resto fica atrás do
 * seletor manual.
 */
export function MaterialsCard({ examPrepId, materials, suggestedMaterials }: MaterialsCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addMaterial = useAddExamPrepMaterial(examPrepId);
  const removeMaterial = useRemoveExamPrepMaterial(examPrepId);

  const linkedAttachmentIds = materials.map((material) => material.attachment.id);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Materiais</h2>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Adicionar
        </Button>
      </div>

      {materials.length === 0 && suggestedMaterials.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum material vinculado ainda.</p>
      )}

      {materials.length > 0 && (
        <ul className="space-y-0.5">
          {materials.map((material) => {
            const Icon = TYPE_ICONS[material.attachment.type];

            return (
              <li
                key={material.id}
                className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{material.attachment.name}</span>
                <button
                  type="button"
                  onClick={() => removeMaterial.mutate(material.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Desvincular ${material.attachment.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {suggestedMaterials.length > 0 && (
        <div className="space-y-1 rounded-lg border border-dashed p-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3" aria-hidden />
            Já vinculados a esta prova
          </p>

          {suggestedMaterials.map((attachment) => {
            const Icon = TYPE_ICONS[attachment.type];

            return (
              <div key={attachment.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-xs"
                  disabled={addMaterial.isPending}
                  onClick={() => addMaterial.mutate({ attachmentId: attachment.id })}
                >
                  Adicionar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <MaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        examPrepId={examPrepId}
        linkedAttachmentIds={linkedAttachmentIds}
      />
    </Card>
  );
}
