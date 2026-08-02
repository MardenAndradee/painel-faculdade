import { cn } from '@/lib/utils';

/**
 * Placeholder de carregamento.
 *
 * Usado com o formato aproximado do conteudo real: assim o layout nao "salta"
 * quando os dados chegam, o que um spinner central nao evita.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden {...props} />
  );
}
