// Form validation schemas and utilities for CRM
import { z } from 'zod';

// Lead form validation schema
export const leadSchema = z.object({
  contact: z.object({
    name: z.string().min(1, 'Nombre requerido'),
    phone: z.string().min(1, 'Teléfono requerido'),
    email: z.string().email('Email inválido').optional().or(z.literal(''))
  }),
  trip: z.object({
    type: z.enum(['hotel', 'flight', 'package']),
    city: z.string().min(1, 'Ciudad requerida'),
    dates: z.object({
      checkin: z.string().min(1, 'Fecha de entrada requerida'),
      checkout: z.string().min(1, 'Fecha de salida requerida')
    }),
    adults: z.number().min(1, 'Mínimo 1 adulto'),
    children: z.number().min(0, 'No puede ser negativo')
  }),
  status: z.enum(['new', 'quoted', 'negotiating', 'won', 'lost']).optional(),
  section_id: z.string().optional(),
  seller_id: z.string().optional(),
  budget: z.number().min(0).optional(),
  description: z.string().optional(),
  due_date: z.string().optional()
});

export type LeadFormValidationData = z.infer<typeof leadSchema>;

// Section validation schema
export const sectionSchema = z.object({
  name: z.string().min(1, 'Nombre de sección requerido'),
  color: z.string().optional(),
  position: z.number().min(0),
  locked: z.boolean().optional()
});

export type SectionFormValidationData = z.infer<typeof sectionSchema>;

// Travel selection validation
export const travelSelectionSchema = z.object({
  selectedFlights: z.array(z.any()).optional(),
  selectedHotels: z.array(z.any()).optional(),
  activeTab: z.enum(['flights', 'hotels', 'combined']).optional()
});

export type TravelSelectionValidationData = z.infer<typeof travelSelectionSchema>;

// Validation utilities
export class ValidationService {
  // Validate lead form data
  static validateLead(data: unknown): {
    success: boolean;
    data?: LeadFormValidationData;
    errors?: z.ZodError;
  } {
    try {
      const validatedData = leadSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error };
      }
      throw error;
    }
  }

  // Validate section data
  static validateSection(data: unknown): {
    success: boolean;
    data?: SectionFormValidationData;
    errors?: z.ZodError;
  } {
    try {
      const validatedData = sectionSchema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error };
      }
      throw error;
    }
  }

  // Custom validation rules
  static validateDateRange(checkin: string, checkout: string): string[] {
    const errors: string[] = [];

    if (!checkin || !checkout) {
      return errors;
    }

    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if dates are in the past
    if (checkinDate < today) {
      errors.push('La fecha de entrada no puede ser en el pasado');
    }

    // Check if checkout is after checkin
    if (checkoutDate <= checkinDate) {
      errors.push('La fecha de salida debe ser posterior a la fecha de entrada');
    }

    // Check if trip is too long (e.g., more than 365 days)
    const diffTime = checkoutDate.getTime() - checkinDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 365) {
      errors.push('El viaje no puede durar más de 365 días');
    }

    return errors;
  }

  // Phone number validation
  static validatePhone(phone: string): boolean {
    // Basic phone validation - can be enhanced
    const phoneRegex = /^[\+]?[(]?[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  // Budget validation
  static validateBudget(budget: number, tripType: 'hotel' | 'flight' | 'package'): string[] {
    const errors: string[] = [];

    if (budget < 0) {
      errors.push('El presupuesto no puede ser negativo');
    }

    // Set minimum reasonable budgets by trip type
    const minimums = {
      hotel: 50,
      flight: 100,
      package: 200
    };

    if (budget > 0 && budget < minimums[tripType]) {
      errors.push(`El presupuesto mínimo para ${tripType} es $${minimums[tripType]}`);
    }

    // Set maximum reasonable budget (to catch input errors)
    if (budget > 100000) {
      errors.push('El presupuesto parece muy alto, verifique el monto');
    }

    return errors;
  }

  // Comprehensive lead validation
  static validateLeadComplete(data: LeadFormValidationData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate date range
    const dateErrors = this.validateDateRange(
      data.trip.dates.checkin,
      data.trip.dates.checkout
    );
    errors.push(...dateErrors);

    // Validate phone
    if (!this.validatePhone(data.contact.phone)) {
      errors.push('El formato del teléfono no es válido');
    }

    // Validate budget if provided
    if (data.budget && data.budget > 0) {
      const budgetErrors = this.validateBudget(data.budget, data.trip.type);
      errors.push(...budgetErrors);
    } else {
      warnings.push('No se ha especificado un presupuesto');
    }

    // Check if due date is reasonable
    if (data.due_date) {
      const dueDate = new Date(data.due_date);
      const tripStart = new Date(data.trip.dates.checkin);

      if (dueDate > tripStart) {
        warnings.push('La fecha límite es posterior al inicio del viaje');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}