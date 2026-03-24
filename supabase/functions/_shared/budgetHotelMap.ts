/**
 * Budget-to-hotel constraints mapping for the planner agent.
 * Used by search_hotels tool to filter and rank EUROVIPS results.
 */

export const BUDGET_HOTEL_MAP = {
  low:    { maxStars: 2, maxPricePerNight: 60,   label: 'económico' },
  mid:    { maxStars: 3, maxPricePerNight: 150,  label: 'confort' },
  high:   { maxStars: 4, maxPricePerNight: 300,  label: 'superior' },
  luxury: { maxStars: 5, maxPricePerNight: 9999, label: 'lujo' },
} as const;

export type BudgetLevel = keyof typeof BUDGET_HOTEL_MAP;

export function getBudgetConstraints(level: BudgetLevel) {
  return BUDGET_HOTEL_MAP[level];
}

/**
 * Detect budget level from natural language text (Spanish).
 * Returns detected level and optional explicit price cap.
 */
export function detectBudgetFromText(text: string): {
  level: BudgetLevel | null;
  maxPricePerNight: number | null;
} {
  const lower = text.toLowerCase();

  // Explicit price: "menos de $100", "no más de 80 dólares", "hasta $200"
  const priceMatch = lower.match(
    /(?:menos de|no más de|no mas de|hasta|máximo?|maximo?)\s*\$?\s*(\d+)/
  );
  if (priceMatch) {
    const price = parseInt(priceMatch[1], 10);
    const level: BudgetLevel = price <= 60 ? 'low'
      : price <= 150 ? 'mid'
      : price <= 300 ? 'high'
      : 'luxury';
    return { level, maxPricePerNight: price };
  }

  // Luxury keywords
  if (/\b(lujo|luxury|5 estrellas|cinco estrellas|lo mejor|top|vip)\b/.test(lower))
    return { level: 'luxury', maxPricePerNight: null };

  // High keywords
  if (/\b(4 estrellas|cuatro estrellas|algo bueno|superior|premium)\b/.test(lower))
    return { level: 'high', maxPricePerNight: null };

  // Mid keywords
  if (/\b(buen hotel|algo lindo|confortable|3 estrellas|tres estrellas|cómodo|comodo)\b/.test(lower))
    return { level: 'mid', maxPricePerNight: null };

  // Low keywords
  if (/\b(barato|económico|economico|low cost|sin gastar|presupuesto|hostel|mochilero|accesible)\b/.test(lower))
    return { level: 'low', maxPricePerNight: null };

  return { level: null, maxPricePerNight: null };
}
