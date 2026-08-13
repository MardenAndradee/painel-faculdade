'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Users } from 'lucide-react';
import { useClasses } from '@/hooks/use-classes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ClassCard } from '@/components/classes/class-card';
import { ClassFormDialog } from '@/components/classes/class-form-dialog';

/** Listagem de turmas (Etapa 20): as que o usuário criou e as que entrou. */
export default function ClassesPage() {
  const { data: classes, isLoading, isError, error, refetch } = useClasses();
  const [formOpen, setFormOpen] = useState(false);

  const items = classes ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Turmas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {classes
              ? `${items.length} ${items.length === 1 ? 'turma' : 'turmas'}`
              : 'Carregando...'}
          </p>
        </div>

        <Button variant="accent" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nova turma</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-6 h-3 w-1/3" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as turmas"
            description={error instanceof Error ? error.message : 'Tente novamente.'}
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <RefreshCw className="size-4" aria-hidden />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhuma turma ainda"
            description="Crie uma turma para compartilhar avisos e atividades, ou entre numa usando um link ou código de convite."
            action={
              <Button variant="accent" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Criar turma
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((classItem) => (
            <ClassCard key={classItem.id} classItem={classItem} />
          ))}
        </div>
      )}

      <ClassFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
