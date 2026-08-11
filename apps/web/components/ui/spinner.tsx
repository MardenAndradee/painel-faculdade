import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
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

/**
 * Estado de carregamento que ocupa a altura total da viewport.
 *
 * Leva a marca porque os cinco lugares onde ele aparece sao o mesmo momento:
 * o app resolvendo a sessao antes de decidir para onde levar a pessoa (raiz,
 * guarda de rota, retorno do OAuth). Sem ela a primeira coisa que se ve ao
 * abrir o app e uma tela em branco com um circulo girando, que nao diz nem
 * qual aplicacao esta carregando.
 *
 * A marca fica estatica e so o circulo gira: animar a logo a cada troca de
 * rota daria a um instante de espera um peso que ele nao tem.
 */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo markClassName="size-11" className="flex-col gap-2.5 text-lg" />
      <Spinner label={label} />
    </div>
  );
}
