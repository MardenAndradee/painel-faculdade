'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        // Rola horizontalmente no celular em vez de espremer as abas.
        'inline-flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg border-b p-0 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:border-primary data-[state=active]:text-foreground',
        'hover:text-foreground',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('ring-offset-background focus-visible:outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
