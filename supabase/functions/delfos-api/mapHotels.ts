/**
 * Delfos HotelOffer → Wholesale HotelData-like item.
 * Pure — no Deno/network. Search-only; preserves offer_id for future booking.
 */

function parseMoneyAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  return 0;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00.000Z`);
  const b = new Date(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

function formatCancelPolicies(policies: any[]): string {
  if (!Array.isArray(policies) || policies.length === 0) return '';
  return policies
    .map((p) => {
      const deadline = p?.deadline ? String(p.deadline) : '';
      const amount = p?.penalty?.amount != null ? String(p.penalty.amount) : '';
      const currency = p?.penalty?.currency ? String(p.penalty.currency) : '';
      const desc = p?.description ? String(p.description) : '';
      return [deadline, amount && currency ? `${amount} ${currency}` : amount, desc]
        .filter(Boolean)
        .join(' — ');
    })
    .filter(Boolean)
    .join('; ');
}

export interface MapHotelsContext {
  checkIn?: string;
  checkOut?: string;
  city?: string;
  adults?: number;
  children?: number;
  infants?: number;
  childrenAges?: number[];
}

export function mapDelfosHotelOffer(offer: any, ctx: MapHotelsContext = {}): any {
  const checkIn = ctx.checkIn || '';
  const checkOut = ctx.checkOut || '';
  const nights = nightsBetween(checkIn, checkOut);
  const totalPrice = parseMoneyAmount(offer?.price?.amount);
  const currency = String(offer?.price?.currency || 'USD').toUpperCase();
  const mealCodes = Array.isArray(offer?.meal_plan?.codes)
    ? offer.meal_plan.codes.map((c: unknown) => String(c))
    : [];
  const roomName = String(offer?.room_type?.name || offer?.room_type?.code || 'Room');
  const hotelName = String(offer?.hotel?.name || 'Hotel');
  const hotelCode = String(offer?.hotel?.code || '');
  const offerId = String(offer?.offer_id || `delfos-hotel-${hotelCode}`);

  return {
    id: offerId,
    unique_id: offerId,
    hotel_id: hotelCode || offerId,
    name: hotelName,
    category: '',
    city: ctx.city || '',
    address: '',
    phone: undefined,
    website: undefined,
    description: undefined,
    images: [],
    rooms: [
      {
        type: roomName,
        description: [
          roomName,
          mealCodes.length ? `Meal: ${mealCodes.join(',')}` : '',
          offer?.rate_plan?.code ? `Rate: ${offer.rate_plan.code}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        price_per_night: nights > 0 ? Math.round((totalPrice / nights) * 100) / 100 : totalPrice,
        total_price: totalPrice,
        currency,
        meal_plan: mealCodes.join(',') || undefined,
        fare_id_broker: offerId,
      },
    ],
    check_in: checkIn,
    check_out: checkOut,
    nights,
    policy_cancellation: formatCancelPolicies(offer?.cancel_policies || []) ||
      (offer?.refundable === false ? 'Non-refundable' : undefined),
    policy_lodging: undefined,
    search_adults: ctx.adults,
    search_children: ctx.children,
    search_infants: ctx.infants,
    search_childrenAges: ctx.childrenAges,
    provider: 'DELFOS',
    providerOfferId: offerId,
    providerMeta: {
      expiresAt: offer?.expires_at ? String(offer.expires_at) : undefined,
      sourceProvider: 'dingus',
    },
  };
}

export function mapDelfosHotelOffers(offers: any[], ctx: MapHotelsContext = {}): any[] {
  if (!Array.isArray(offers)) return [];
  return offers.map((offer) => mapDelfosHotelOffer(offer, ctx));
}
