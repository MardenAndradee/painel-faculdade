import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge de status.
 *
 * As variantes semanticas (pending/completed/overdue) usam os tokens definidos
 * em globals.css, e nao cores fixas - assim mudam junto com o tema.
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive border-destructive/20',
        pending: 'border-transparent bg-status-pending/15 text-status-pending',
        completed: 'border-transparent bg-status-completed/15 text-status-completed',
        overdue: 'border-transparent bg-status-overdue/15 text-status-overdue',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
