import Link from 'next/link';
import { GraduationCap, Users } from 'lucide-react';
import { CLASS_ROLE_LABELS, type ClassSummary } from '@painel/shared';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { subjectInitials } from '@/lib/format';

interface ClassCardProps {
  classItem: ClassSummary;
}

export function ClassCard({ classItem }: ClassCardProps) {
  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40">
      <span
        className="absolute inset-x-0 top-0 h-0.5 opacity-90"
        style={{ backgroundColor: classItem.color }}
        aria-hidden
      />

      <Link href={`/turmas/${classItem.id}`} className="block p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
            style={{ backgroundColor: `${classItem.color}1f`, color: classItem.color }}
            aria-hidden
          >
            {subjectInitials(classItem.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium tracking-tight">{classItem.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {classItem.year}.{String(classItem.term).padStart(2, '0')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {classItem.myRole === 'OWNER' && (
              <Badge variant="outline">{CLASS_ROLE_LABELS.OWNER}</Badge>
            )}
            {classItem.archivedAt && <Badge variant="secondary">Arquivada</Badge>}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {classItem.memberCount} {classItem.memberCount === 1 ? 'membro' : 'membros'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="size-3.5" aria-hidden />
            {classItem.subjectCount} {classItem.subjectCount === 1 ? 'disciplina' : 'disciplinas'}
          </span>
        </div>
      </Link>
    </Card>
  );
}
