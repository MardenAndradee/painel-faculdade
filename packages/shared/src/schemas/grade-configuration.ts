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

// --- Propagacao do modelo do semestre (Etapa 18) -------------------------------

/**
 * Propagacao do modelo de um semestre para as disciplinas ja criadas nele.
 *
 * A Etapa 17 decidiu que `GradeConfiguration` e COPIADA, nunca compartilhada:
 * editar a configuracao de uma disciplina jamais pode mexer em outra. Isso
 * continua valendo - mas surpreende quem adiciona um componente ao modelo de
 * "2026.2" e espera ve-lo nas disciplinas daquele periodo.
 *
 * A saida e um passo explicito: o backend calcula a diferenca, a tela mostra o
 * que mudaria em cada disciplina, e so as marcadas sao atualizadas. Nenhuma
 * disciplina muda sem confirmacao.
 */

/** O que muda numa disciplina se ela for marcada para receber o modelo. */
export type GradeTemplateChangeKind = 'ADD_COMPONENT' | 'UPDATE_WEIGHT' | 'UPDATE_PASSING_GRADE';

export interface GradeTemplateChange {
  kind: GradeTemplateChangeKind;
  /** Nome do componente; ausente em `UPDATE_PASSING_GRADE`, que e da disciplina inteira. */
  componentName: string | null;
  /** Valor atual na disciplina. `null` quando o componente ainda nao existe la. */
  from: number | null;
  /** Valor que o modelo passaria a impor. */
  to: number;
  /**
   * O componente ja tem nota lancada.
   *
   * Importa porque mudar o peso ai nao e cosmetico: recalcula a media que a
   * pessoa ja viu na tela.
   */
  affectsGrades: boolean;
}

export interface GradeTemplateSubjectDiff {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  changes: GradeTemplateChange[];
}

export interface GradeTemplatePropagationPreview {
  semester: { id: string; name: string };
  /** Apenas disciplinas com alguma diferenca - lista vazia significa "nada a propagar". */
  subjects: GradeTemplateSubjectDiff[];
}

export const propagateGradeTemplateSchema = z.object({
  subjectIds: z
    .array(z.string().min(1))
    .min(1, 'Selecione ao menos uma disciplina')
    .max(200, 'Disciplinas demais'),
});

export type PropagateGradeTemplateInput = z.infer<typeof propagateGradeTemplateSchema>;

export interface GradeTemplatePropagationResult {
  /** Quantas disciplinas foram efetivamente atualizadas. */
  updatedSubjects: number;
}
