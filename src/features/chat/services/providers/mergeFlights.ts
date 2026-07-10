/**
 * Client mirror of supabase/functions/_shared/providers/mergeFlights.ts
 * Keep in sync (ADR-003).
 */

const DEFAULT_FLIGHT_MERGE_CAP = 40;

function priceAmount(flight: any): number {
  const amount = flight?.price?.amount;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function flightSoftKey(flight: any): string {
  const firstLeg = flight?.legs?.[0];
  const firstOption = firstLeg?.options?.[0];
  const segments = firstOption?.segments || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const airline = normalizeText(flight?.airline?.code || first?.airline || '');
  const flightNo = normalizeText(first?.flightNumber || first?.flight_number || '');
  const dep = `${first?.departure?.airportCode || ''}|${first?.departure?.date || ''}|${first?.departure?.time || ''}`;
  const arr = `${last?.arrival?.airportCode || ''}|${last?.arrival?.date || ''}|${last?.arrival?.time || ''}`;
  return `${airline}|${flightNo}|${dep}|${arr}`;
}

function pricesNearlyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === b) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= 0.01;
}

export function mergeFlights(batches: any[][], options: { cap?: number } = {}): any[] {
  const cap = options.cap ?? DEFAULT_FLIGHT_MERGE_CAP;
  const byKey = new Map<string, any[]>();

  for (const batch of batches) {
    for (const flight of batch || []) {
      if (!flight) continue;
      const key = flightSoftKey(flight);
      const group = byKey.get(key) || [];
      group.push(flight);
      byKey.set(key, group);
    }
  }

  const merged: any[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    group.sort((a, b) => priceAmount(a) - priceAmount(b));
    const kept: any[] = [group[0]];
    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      const samePriceAsAny = kept.some((k) => pricesNearlyEqual(priceAmount(k), priceAmount(candidate)));
      if (samePriceAsAny) continue;
      kept.push(candidate);
    }
    merged.push(...kept);
  }

  merged.sort((a, b) => priceAmount(a) - priceAmount(b));
  return merged.slice(0, Math.max(0, cap));
}
