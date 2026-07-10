/**
 * Client mirror of supabase/functions/_shared/providers/mergeHotels.ts
 * Keep in sync (ADR-003).
 */

const DEFAULT_HOTEL_MERGE_CAP = 40;

function normalizeHotelText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function minRoomPrice(hotel: any): number {
  if (!Array.isArray(hotel?.rooms) || hotel.rooms.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.min(
    ...hotel.rooms.map((room: any) => {
      const p = room?.total_price;
      return typeof p === 'number' && Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
    }),
  );
}

export function hotelSoftKey(hotel: any): string {
  const name = normalizeHotelText(hotel?.name);
  const checkIn = String(hotel?.check_in || hotel?.checkIn || '');
  const checkOut = String(hotel?.check_out || hotel?.checkOut || '');
  return `${name}|${checkIn}|${checkOut}`;
}

function pricesNearlyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === b) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= 0.01;
}

export function mergeHotels(batches: any[][], options: { cap?: number } = {}): any[] {
  const cap = options.cap ?? DEFAULT_HOTEL_MERGE_CAP;
  const byKey = new Map<string, any[]>();

  for (const batch of batches) {
    for (const hotel of batch || []) {
      if (!hotel) continue;
      const key = hotelSoftKey(hotel);
      const group = byKey.get(key) || [];
      group.push(hotel);
      byKey.set(key, group);
    }
  }

  const merged: any[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    group.sort((a, b) => minRoomPrice(a) - minRoomPrice(b));
    const kept: any[] = [group[0]];
    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      if (pricesNearlyEqual(minRoomPrice(candidate), minRoomPrice(group[0]))) continue;
      if (candidate?.provider && candidate.provider !== group[0]?.provider) {
        kept.push(candidate);
      }
    }
    merged.push(...kept);
  }

  merged.sort((a, b) => minRoomPrice(a) - minRoomPrice(b));
  return merged.slice(0, Math.max(0, cap));
}
