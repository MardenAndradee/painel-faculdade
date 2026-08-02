'use client';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Painel deslizante, usado pela sidebar no mobile.
 *
 * Construido sobre o Dialog do Radix, que ja entrega foco preso no painel,
 * fechamento por Escape e atributos ARIA corretos.
 */

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;

function SheetContent({
  className,
  children,
  side = 'left',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

      <SheetPrimitive.Content
        className={cn(
          'fixed z-50 flex h-full w-72 flex-col gap-0 border-r bg-sidebar shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in',
          side === 'left'
            ? 'inset-y-0 left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
            : 'inset-y-0 right-0 border-r-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      >
        {children}

        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none">
          <X className="size-4" aria-hidden />
          <span className="sr-only">Fechar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
