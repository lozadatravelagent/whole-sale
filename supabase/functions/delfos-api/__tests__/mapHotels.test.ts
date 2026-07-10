import { describe, expect, it } from 'vitest';
import { mapDelfosHotelOffer } from '../mapHotels.ts';
import { buildDelfosHotelSearchBody } from '../buildRequest.ts';

const sampleOffer = {
  offer_id: 'hof_01J00000000000000000000000',
  hotel: { code: 'H123', name: 'Hotel Ejemplo Cancun' },
  room_type: { code: 'DBL', name: 'Doble' },
  rate_plan: { code: 'GENERAL' },
  meal_plan: { codes: ['AI'] },
  price: { amount: '450.00', currency: 'USD' },
  cancel_policies: [],
  refundable: false,
  expires_at: '2026-07-10T18:00:00Z',
};

describe('mapDelfosHotelOffer', () => {
  it('maps hotel offer to canonical HotelData-like shape', () => {
    const mapped = mapDelfosHotelOffer(sampleOffer, {
      checkIn: '2026-08-15',
      checkOut: '2026-08-20',
      city: 'Cancun',
      adults: 2,
    });
    expect(mapped.provider).toBe('DELFOS');
    expect(mapped.providerOfferId).toBe('hof_01J00000000000000000000000');
    expect(mapped.name).toBe('Hotel Ejemplo Cancun');
    expect(mapped.rooms[0].total_price).toBe(450);
    expect(mapped.nights).toBe(5);
    expect(mapped.rooms[0].price_per_night).toBe(90);
    expect(mapped.providerMeta.expiresAt).toBe('2026-07-10T18:00:00Z');
    expect(mapped.policy_cancellation).toBe('Non-refundable');
  });
});

describe('buildDelfosHotelSearchBody', () => {
  it('builds body without hotel_codes by default', () => {
    const result = buildDelfosHotelSearchBody({
      checkIn: '2026-08-15',
      checkOut: '2026-08-20',
      adults: 2,
      children: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.check_in).toBe('2026-08-15');
    expect(result.body.rooms).toEqual([{ adults: 2, children_ages: [8] }]);
    expect(result.body.hotel_codes).toBeUndefined();
  });

  it('rejects invalid dates', () => {
    const result = buildDelfosHotelSearchBody({ checkIn: 'bad', checkOut: '2026-08-20' });
    expect(result.ok).toBe(false);
  });
});
