import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Botao base do design system (padrao shadcn/ui).
 *
 * `asChild` permite renderizar o estilo sobre outro elemento (um <a>, por
 * exemplo) sem aninhar tags interativas.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        /**
         * Contorno tingido na cor primaria - a acao de destaque do redesign
         * escuro, nunca um preenchimento solido. Fundo parte de `bg-secondary`
         * (a mesma superficie escura de um botao neutro) em vez de uma tinta
         * azul: so a borda e o texto entregam a cor em repouso, o azul so
         * ganha peso no hover.
         */
        accent:
          'border border-primary/40 bg-secondary text-primary shadow-xs hover:border-primary/60 hover:bg-primary/15',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  if (asChild) {
    const { children, ...rest } = props;
    const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;

    return React.cloneElement(child, {
      ...rest,
      className: cn(buttonVariants({ variant, size }), child.props.className, className),
    });
  }

  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
