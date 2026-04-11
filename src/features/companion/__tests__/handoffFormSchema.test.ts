import { describe, it, expect } from 'vitest';
import { handoffFormSchema } from '../utils/handoffFormSchema';

const validBase = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '+54 11 5555-1234',
  adults: 2,
  children: 0,
};

describe('handoffFormSchema', () => {
  it('accepts a minimum valid payload', () => {
    const result = handoffFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = handoffFormSchema.safeParse({ ...validBase, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('rejects invalid email format', () => {
    const result = handoffFormSchema.safeParse({ ...validBase, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });

  it('rejects phone shorter than 6 characters', () => {
    const result = handoffFormSchema.safeParse({ ...validBase, phone: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'phone')).toBe(true);
    }
  });

  it('rejects adults = 0', () => {
    const result = handoffFormSchema.safeParse({ ...validBase, adults: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts prefilled dates, origin, budgetLevel and comment', () => {
    const result = handoffFormSchema.safeParse({
      ...validBase,
      origin: 'Buenos Aires',
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      budgetLevel: 'mid',
      comment: 'Preferimos zona centro y hoteles 4 estrellas.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects endDate before startDate', () => {
    const result = handoffFormSchema.safeParse({
      ...validBase,
      startDate: '2026-07-22',
      endDate: '2026-07-15',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('endDate'))).toBe(true);
    }
  });

  it('rejects unknown budgetLevel', () => {
    const result = handoffFormSchema.safeParse({
      ...validBase,
      budgetLevel: 'extravagant' as never,
    });
    expect(result.success).toBe(false);
  });
});
