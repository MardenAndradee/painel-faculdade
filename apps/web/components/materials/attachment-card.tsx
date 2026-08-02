'use client';

import {
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileText,
  Link2,
  MoreVertical,
  Pencil,
  Presentation,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  ATTACHMENT_SOURCE_LABELS,
  ATTACHMENT_TYPE_LABELS,
  type AttachmentListItem,
  type AttachmentType,
} from '@painel/shared';
import { useDownloadAttachment } from '@/hooks/use-attachments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes, formatRelative } from '@/lib/format';

interface AttachmentCardProps {
  attachment: AttachmentListItem;
  onPreview: (attachment: AttachmentListItem) => void;
  onEdit: (attachment: AttachmentListItem) => void;
  onDelete: (attachment: AttachmentListItem) => void;
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

/** Cor do icone por tipo, para dar leitura rapida no meio de uma grade. */
const TYPE_TONES: Record<AttachmentType, string> = {
  PDF: 'text-status-overdue bg-status-overdue/10',
  IMAGE: 'text-status-completed bg-status-completed/10',
  ZIP: 'text-status-pending bg-status-pending/10',
  SLIDE: 'text-status-pending bg-status-pending/10',
  LINK: 'text-primary bg-primary/10',
  DOCUMENT: 'text-muted-foreground bg-muted',
  OTHER: 'text-muted-foreground bg-muted',
};

export function AttachmentCard({ attachment, onPreview, onEdit, onDelete }: AttachmentCardProps) {
  const download = useDownloadAttachment();
  const Icon = TYPE_ICONS[attachment.type];
  const isLink = attachment.source === 'LINK';

  const linkedTo = attachment.subject ?? attachment.assignment ?? attachment.exam;
  const linkedLabel =
    attachment.subject?.name ?? attachment.assignment?.title ?? attachment.exam?.title ?? null;

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4" data-testid="attachment-card">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`shrink-0 rounded-lg p-2 ${TYPE_TONES[attachment.type]}`}>
          <Icon className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          {/* Duas linhas em vez de truncar: o nome e o que identifica o
              material, e cortar em "Aula 04 - Arvore..." obriga o usuario a
              passar o mouse para saber o que abriu. */}
          <p className="line-clamp-2 text-sm font-medium" title={attachment.name}>
            {attachment.name}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {ATTACHMENT_TYPE_LABELS[attachment.type]}
            {attachment.sizeBytes !== null && ` · ${formatBytes(attachment.sizeBytes)}`}
            {` · ${formatRelative(attachment.createdAt)}`}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Ações de ${attachment.name}`}
            >
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {attachment.isPreviewable && (
              <DropdownMenuItem onClick={() => onPreview(attachment)}>
                <Eye aria-hidden />
                Visualizar
              </DropdownMenuItem>
            )}

            {isLink ? (
              <DropdownMenuItem asChild>
                {/* `noopener` impede que a pagina aberta manipule esta via window.opener. */}
                <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  Abrir link
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => download.mutate({ id: attachment.id, name: attachment.name })}
              >
                <Download aria-hidden />
                Baixar
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onEdit(attachment)}>
              <Pencil aria-hidden />
              Editar
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={() => onDelete(attachment)}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{ATTACHMENT_SOURCE_LABELS[attachment.source]}</Badge>

        {linkedTo && (
          <Badge variant="outline" className="min-w-0">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                backgroundColor: attachment.subject?.color ?? 'var(--color-muted-foreground)',
              }}
              aria-hidden
            />
            <span className="truncate">{linkedLabel}</span>
          </Badge>
        )}
      </div>
    </Card>
  );
}
