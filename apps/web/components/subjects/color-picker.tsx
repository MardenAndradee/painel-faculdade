'use client';

import { Check } from 'lucide-react';
import { SUBJECT_COLORS } from '@painel/shared';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  id?: string;
}

/**
 * Seletor de cor da disciplina.
 *
 * Paleta fixa em vez de `<input type="color">`: as cores viram barras e pontos
 * no calendario e nos cards, e uma escolha livre permitiria tons sem contraste
 * suficiente contra o fundo em um dos temas.
 */
export function ColorPicker({ value, onChange, id }: ColorPickerProps) {
  return (
    <div id={id} role="radiogroup" aria-label="Cor da disciplina" className="flex flex-wrap gap-2">
      {SUBJECT_COLORS.map((color) => {
        const isSelected = value.toLowerCase() === color.toLowerCase();

        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Cor ${color}`}
            onClick={() => onChange(color)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
              isSelected ? 'scale-110' : 'hover:scale-105',
            )}
            style={{ backgroundColor: color }}
          >
            {isSelected && <Check className="size-3.5 text-white drop-shadow" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
