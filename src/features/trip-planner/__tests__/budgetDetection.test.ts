import { describe, it, expect } from 'vitest';
import { detectBudgetFromText } from '../../../../supabase/functions/_shared/budgetHotelMap';

describe('detectBudgetFromText', () => {
  // Low budget
  it('"algo barato" → low', () => {
    expect(detectBudgetFromText('algo barato').level).toBe('low');
  });
  it('"económico" → low', () => {
    expect(detectBudgetFromText('quiero algo económico').level).toBe('low');
  });
  it('"mochilero" → low', () => {
    expect(detectBudgetFromText('viaje mochilero').level).toBe('low');
  });

  // Mid budget
  it('"buen hotel" → mid', () => {
    expect(detectBudgetFromText('quiero un buen hotel').level).toBe('mid');
  });
  it('"algo lindo" → mid', () => {
    expect(detectBudgetFromText('algo lindo pero no caro').level).toBe('mid');
  });

  // High budget
  it('"4 estrellas" → high', () => {
    expect(detectBudgetFromText('un hotel de 4 estrellas').level).toBe('high');
  });

  // Luxury
  it('"5 estrellas" → luxury', () => {
    expect(detectBudgetFromText('quiero 5 estrellas').level).toBe('luxury');
  });
  it('"lo mejor" → luxury', () => {
    expect(detectBudgetFromText('quiero lo mejor').level).toBe('luxury');
  });

  // Explicit price
  it('"menos de $80" → maxPricePerNight: 80', () => {
    const r = detectBudgetFromText('menos de $80 la noche');
    expect(r.maxPricePerNight).toBe(80);
  });
  it('"no más de $200" → maxPricePerNight: 200', () => {
    const r = detectBudgetFromText('no más de $200 por noche');
    expect(r.maxPricePerNight).toBe(200);
  });
  it('"hasta 150" → maxPricePerNight: 150', () => {
    const r = detectBudgetFromText('hasta 150 dólares la noche');
    expect(r.maxPricePerNight).toBe(150);
  });

  // No detection
  it('neutral text → level: null', () => {
    const r = detectBudgetFromText('quiero un hotel en Madrid');
    expect(r.level).toBeNull();
    expect(r.maxPricePerNight).toBeNull();
  });
  it('empty string → null, null', () => {
    const r = detectBudgetFromText('');
    expect(r.level).toBeNull();
    expect(r.maxPricePerNight).toBeNull();
  });
});
