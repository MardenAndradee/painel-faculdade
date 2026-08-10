import { z } from 'zod';

/**
 * Contrato de configuracao de notas (Etapa 17).
 *
 * O sistema nao sabe que existem "N1/N2/N3" - ele sabe que existem
 * componentes de avaliacao configuraveis, com nome e peso livres. Uma
 * disciplina tem sempre uma configuracao propria (1-1, independente mesmo
 * quando copiada de um modelo); um semestre pode opcionalmente ter um
 * modelo padrao, usado so para pre-preencher disciplinas novas.
 */

/** Um componente no payload de entrada. `id` presente = atualiza; ausente = cria. */
const gradeComponentInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z
    .string({ error: 'Informe o nome do componente' })
    .trim()
    .min(1, 'Informe o nome do componente')
    .max(60, 'Máximo de 60 caracteres'),
  weight: z.coerce
    .number({ error: 'Informe o peso' })
    .positive('O peso precisa ser maior que zero')
    .max(100, 'Peso muito alto'),
});

export type GradeComponentFormValues = z.input<typeof gradeComponentInputSchema>;

/** Substitui o conjunto inteiro de componentes - ver o service para a regra de exclusao. */
export const gradeConfigurationInputSchema = z.object({
  passingGrade: z.coerce
    .number({ error: 'Informe a nota de aprovação' })
    .min(0, 'Não pode ser negativo')
    .max(10, 'A nota máxima é 10')
    .default(6),
  components: z.array(gradeComponentInputSchema).max(20, 'Máximo de 20 componentes').default([]),
});

export type GradeConfigurationInput = z.output<typeof gradeConfigurationInputSchema>;
export type GradeConfigurationFormValues = z.input<typeof gradeConfigurationInputSchema>;

export interface GradeComponentItem {
  id: string;
  name: string;
  weight: number;
  order: number;
  /** Ja tem nota lancada - o componente nao pode ser excluido enquanto isso for verdade. */
  hasGrade: boolean;
}

export interface GradeConfigurationItem {
  id: string;
  passingGrade: number;
  components: GradeComponentItem[];
}
