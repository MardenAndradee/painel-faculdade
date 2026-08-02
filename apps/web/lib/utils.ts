import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes condicionais (clsx) resolvendo conflitos do Tailwind
 * (twMerge). Base de todos os componentes do shadcn/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
