import { z } from 'zod';

/**
 * Zod schemas for the consumer-facing auth flows (signup) under /emilia/*.
 * Shared by the React pages and by the unit tests. Deliberately narrow —
 * signup collects only the minimum to create a functional account; profile
 * editing is out of scope for MVP.
 */

export const consumerSignupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Ingresá al menos 2 caracteres.')
      .max(120, 'El nombre es demasiado largo.'),
    email: z
      .string()
      .trim()
      .min(1, 'El email es obligatorio.')
      .email('Ingresá un email válido.'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres.')
      .max(200, 'La contraseña es demasiado larga.'),
    confirmPassword: z.string().min(1, 'Repetí la contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type ConsumerSignupFormData = z.infer<typeof consumerSignupSchema>;
