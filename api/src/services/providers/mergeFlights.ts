/**
 * Merge flight results from multiple providers (ADR-003 D6).
 * Pure — no I/O. Keep in sync with src/features/chat/services/providers/mergeFlights.ts
 */

import { DEFAULT_FLIGHT_MERGE_CAP } from './types.js';
import { AIRLINE_NAMES_BY_IATA } from './airlineCatalog.js';

function normalizeIataCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isIataCode(value: string): boolean {
  return /^[A-Z0-9]{2}$/.test(value);
}

export function normalizeAirline(airline: any): { code: string; name: string } {
  const receivedName = typeof airline?.name === 'string' ? airline.name.trim() : '';
  const nameAsCode = normalizeIataCode(receivedName);
  const code = normalizeIataCode(airline?.code) || (isIataCode(nameAsCode) ? nameAsCode : '');
  const hasValidName = receivedName !== '' && !isIataCode(nameAsCode);

  return {
    code,
    name: hasValidName
      ? receivedName
      : AIRLINE_NAMES_BY_IATA[code] ||
        (isIataCode(nameAsCode) ? AIRLINE_NAMES_BY_IATA[nameAsCode] : undefined) ||
        receivedName ||
        code,
  };
}

export function normalizeFlightAirlines(flights: any[]): any[] {
  return (flights || []).map((flight) => ({
    ...flight,
    airline: normalizeAirline(flight?.airline),
  }));
}

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

/** Soft identity: carrier + flight numbers + dep/arr time of first segment. */
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

/**
 * Concatenate, soft-dedupe (keep cheaper when same key + near price; keep both if price diverges),
 * sort by price asc, cap.
 */
export function mergeFlights(
  batches: any[][],
  options: { cap?: number } = {},
): any[] {
  const cap = options.cap ?? DEFAULT_FLIGHT_MERGE_CAP;
  const merged: any[] = [];
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

  for (const group of byKey.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    // Sort group by price; keep cheapest always; keep others only if price diverges >1%
    group.sort((a, b) => priceAmount(a) - priceAmount(b));
    const kept: any[] = [group[0]];
    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      const samePriceAsAny = kept.some((k) => pricesNearlyEqual(priceAmount(k), priceAmount(candidate)));
      const sameProviderAsCheapest = candidate?.provider && candidate.provider === group[0]?.provider;
      if (samePriceAsAny && sameProviderAsCheapest) continue;
      if (samePriceAsAny) continue; // same soft key + same price → drop duplicate
      kept.push(candidate);
    }
    merged.push(...kept);
  }

  merged.sort((a, b) => priceAmount(a) - priceAmount(b));
  return merged.slice(0, Math.max(0, cap));
}
