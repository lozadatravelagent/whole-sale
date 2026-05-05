import { describe, expect, it } from 'vitest';

import { validateFlightRequiredFields, validateHotelRequiredFields } from '@/services/aiMessageParser';

describe('aiMessageParser validation', () => {
  it('rejects placeholder flight values before provider formatting', () => {
    const result = validateFlightRequiredFields({
      origin: 'Buenos Aires',
      destination: 'Madrid',
      departureDate: '[EXTRACT from user or context]',
      adults: 2,
      children: 0,
      infants: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('segment_1_departureDate');
  });

  it('rejects invalid hotel placeholder dates', () => {
    const result = validateHotelRequiredFields({
      city: 'Madrid',
      checkinDate: 'Invalid Date',
      checkoutDate: '[DATE]',
      adults: 2,
      children: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(expect.arrayContaining(['checkinDate', 'checkoutDate']));
  });
});
