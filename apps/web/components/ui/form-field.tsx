import { useId } from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  /** Mensagem vinda do React Hook Form. */
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Recebe os atributos de acessibilidade a aplicar no campo. */
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}

/**
 * Agrupa rotulo, campo e mensagem de erro.
 *
 * Em vez de repetir `id`, `aria-invalid` e `aria-describedby` em cada tela, o
 * componente gera os identificadores e entrega prontos ao campo - errar a
 * ligacao entre rotulo e input deixa de ser possivel.
 */
export function FormField({ label, error, hint, required, className, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-label="obrigatório">
            *
          </span>
        )}
      </Label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
