import { z } from 'zod';

/** Contrato de professores. */

export const createTeacherSchema = z.object({
  name: z
    .string({ error: 'Informe o nome do professor' })
    .trim()
    .min(2, 'O nome precisa de ao menos 2 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),

  email: z.string().trim().email('E-mail inválido').max(160).optional().or(z.literal('')),

  phone: z.string().trim().max(30, 'Máximo de 30 caracteres').optional().or(z.literal('')),

  notes: z.string().trim().max(1000, 'Máximo de 1000 caracteres').optional().or(z.literal('')),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = createTeacherSchema.partial();
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

export interface TeacherListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  subjectCount: number;
  createdAt: string;
}
