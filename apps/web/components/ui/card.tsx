import { cn } from '@/lib/utils';

/**
 * Card base do design system.
 *
 * Composto por partes independentes (Header, Title, Content...) em vez de um
 * componente monolitico com muitas props - cada tela monta apenas o que precisa.
 */

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        // `min-w-0` e essencial: itens de grid/flex tem `min-width: auto` por
        // padrao e nao encolhem abaixo do proprio conteudo, o que faz textos
        // longos estourarem a viewport mesmo com `truncate` nos filhos.
        'flex min-w-0 flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex min-w-0 items-start justify-between gap-3 px-5 pt-5', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-sm font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('min-w-0 px-5 py-4', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('mt-auto flex items-center px-5 pb-5', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
