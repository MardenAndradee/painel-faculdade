'use client';

import {
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileText,
  Link2,
  Presentation,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  ATTACHMENT_SOURCE_LABELS,
  type AttachmentType,
  type ClassMaterialItem,
} from '@painel/shared';
import { useDownloadClassMaterial } from '@/hooks/use-class-materials';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatBytes, formatRelative } from '@/lib/format';

interface ClassMaterialCardProps {
  material: ClassMaterialItem;
  classId: string;
  /** O dono exclui qualquer material; um membro comum só o que ele mesmo enviou. */
  canDelete: boolean;
  onDelete: (material: ClassMaterialItem) => void;
}

const TYPE_ICONS: Record<AttachmentType, LucideIcon> = {
  PDF: FileText,
  IMAGE: FileImage,
  ZIP: FileArchive,
  SLIDE: Presentation,
  LINK: Link2,
  DOCUMENT: FileText,
  OTHER: File,
};

const TYPE_TONES: Record<AttachmentType, string> = {
  PDF: 'text-status-overdue bg-status-overdue/10',
  IMAGE: 'text-status-completed bg-status-completed/10',
  ZIP: 'text-status-pending bg-status-pending/10',
  SLIDE: 'text-status-pending bg-status-pending/10',
  LINK: 'text-primary bg-primary/10',
  DOCUMENT: 'text-muted-foreground bg-muted',
  OTHER: 'text-muted-foreground bg-muted',
};

export function ClassMaterialCard({
  material,
  classId,
  canDelete,
  onDelete,
}: ClassMaterialCardProps) {
  const download = useDownloadClassMaterial(classId);
  const Icon = TYPE_ICONS[material.type];
  const isLink = material.source === 'LINK';

  return (
    <Card className="flex min-w-0 items-start gap-3 p-3">
      <span className={`shrink-0 rounded-lg p-2 ${TYPE_TONES[material.type]}`}>
        <Icon className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium" title={material.name}>
          {material.name}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {material.uploadedBy.name}
          {material.sizeBytes !== null && ` · ${formatBytes(material.sizeBytes)}`}
          {` · ${formatRelative(material.createdAt)}`}
        </p>

        <div className="mt-1.5">
          <Badge variant="secondary">{ATTACHMENT_SOURCE_LABELS[material.source]}</Badge>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isLink ? (
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir link"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Baixar"
            onClick={() => download.mutate({ materialId: material.id, name: material.name })}
          >
            <Download className="size-3.5" aria-hidden />
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Excluir ${material.name}`}
            onClick={() => onDelete(material)}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
}
