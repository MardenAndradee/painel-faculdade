import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  /** Texto lido por leitores de tela enquanto o conteudo carrega. */
  label?: string;
}

export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite">
      <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Estado de carregamento que ocupa a altura total da viewport. */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-8" label={label} />
    </div>
  );
}
