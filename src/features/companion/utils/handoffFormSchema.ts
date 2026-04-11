import { z } from 'zod';

export const BUDGET_LEVELS = ['low', 'mid', 'high', 'luxury'] as const;
export type HandoffBudgetLevel = (typeof BUDGET_LEVELS)[number];

export const handoffFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El nombre es obligatorio.')
      .max(120, 'El nombre es demasiado largo.'),
    email: z
      .string()
      .trim()
      .min(1, 'El email es obligatorio.')
      .email('Ingresá un email válido.'),
    phone: z
      .string()
      .trim()
      .min(6, 'El teléfono es obligatorio.')
      .max(40, 'El teléfono es demasiado largo.'),
    origin: z.string().trim().max(120).optional().or(z.literal('')),
    startDate: z.string().trim().optional().or(z.literal('')),
    endDate: z.string().trim().optional().or(z.literal('')),
    adults: z
      .number({ invalid_type_error: 'Ingresá un número.' })
      .int()
      .min(1, 'Al menos 1 adulto.')
      .max(20, 'Máximo 20 adultos.'),
    children: z
      .number({ invalid_type_error: 'Ingresá un número.' })
      .int()
      .min(0)
      .max(20)
      .default(0),
    budgetLevel: z.enum(BUDGET_LEVELS).optional(),
    comment: z
      .string()
      .trim()
      .max(4000, 'El comentario es demasiado largo.')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.startDate <= data.endDate;
    },
    {
      message: 'La fecha de regreso no puede ser anterior a la de ida.',
      path: ['endDate'],
    }
  );

export type HandoffFormData = z.infer<typeof handoffFormSchema>;
