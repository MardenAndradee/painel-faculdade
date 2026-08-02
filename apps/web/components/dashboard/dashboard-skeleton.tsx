import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton } from './stat-card';

/**
 * Esqueleto do dashboard.
 *
 * Reproduz a grade real - quatro cards, duas colunas de listas - para que o
 * conteudo apareca no lugar onde o placeholder ja estava.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="lg:col-span-1">
            <CardHeader>
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-1 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-56 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
