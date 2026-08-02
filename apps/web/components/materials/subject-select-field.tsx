'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useSubjects } from '@/hooks/use-subjects';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Seletor de disciplina para os formularios de material.
 *
 * O widget e compartilhado; os formularios nao. Criar um link e editar um
 * material tem campos e regras diferentes, entao cada um tem seu proprio
 * schema - o que se repetia entre eles era so este seletor.
 */

/** O Radix nao aceita `value=""` num item, entao "sem disciplina" tem valor proprio. */
const NO_SUBJECT = 'none';

interface SubjectSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  error?: string | undefined;
}

export function SubjectSelectField<T extends FieldValues>({
  control,
  name,
  error,
}: SubjectSelectFieldProps<T>) {
  const { data: subjects } = useSubjects({ page: 1, perPage: 100 });

  return (
    <FormField
      label="Disciplina"
      error={error}
      hint="Opcional — deixe em branco para um material geral"
    >
      {(field) => (
        <Controller
          control={control}
          name={name}
          render={({ field: controlled }) => (
            <Select
              value={
                typeof controlled.value === 'string' && controlled.value
                  ? controlled.value
                  : NO_SUBJECT
              }
              onValueChange={(value) => controlled.onChange(value === NO_SUBJECT ? '' : value)}
            >
              <SelectTrigger id={field.id}>
                <SelectValue placeholder="Sem disciplina" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={NO_SUBJECT}>Sem disciplina</SelectItem>

                {subjects?.data.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  );
}
