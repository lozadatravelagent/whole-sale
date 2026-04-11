import { describe, it, expect } from 'vitest';
import { consumerSignupSchema, consumerLoginSchema } from '../utils/consumerAuthSchema';

const validSignup = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  password: 'supersecret1',
  confirmPassword: 'supersecret1',
};

describe('consumerSignupSchema', () => {
  it('accepts a valid signup payload', () => {
    expect(consumerSignupSchema.safeParse(validSignup).success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = consumerSignupSchema.safeParse({ ...validSignup, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('rejects invalid email format', () => {
    const result = consumerSignupSchema.safeParse({ ...validSignup, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });

  it('rejects password shorter than 8 characters', () => {
    const result = consumerSignupSchema.safeParse({
      ...validSignup,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('rejects mismatched password and confirmPassword', () => {
    const result = consumerSignupSchema.safeParse({
      ...validSignup,
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('trims name and email whitespace', () => {
    const result = consumerSignupSchema.safeParse({
      ...validSignup,
      name: '  Ana Pérez  ',
      email: '  ana@example.com  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Ana Pérez');
      expect(result.data.email).toBe('ana@example.com');
    }
  });
});

describe('consumerLoginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = consumerLoginSchema.safeParse({
      email: 'ana@example.com',
      password: 'supersecret1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty email', () => {
    const result = consumerLoginSchema.safeParse({
      email: '',
      password: 'supersecret1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = consumerLoginSchema.safeParse({
      email: 'ana@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
