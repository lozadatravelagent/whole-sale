import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { resolveHotelbedsDestination } from "../_shared/hotelbedsDestinationResolver.ts";

// ============================================================================
// HOTELBEDS API CLIENT
// ============================================================================

class HotelbedsApiClient {
  private apiKey: string;
  private secret: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: {
    apiKey: string;
    secret: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.baseUrl = config.baseUrl || 'https://api.test.hotelbeds.com';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate X-Signature header: SHA256(apiKey + secret + utcTimestamp)
   */
  private async generateSignature(): Promise<string> {
    const utcTimestamp = Math.floor(Date.now() / 1000);
    const raw = `${this.apiKey}${this.secret}${utcTimestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Build standard auth headers for every Hotelbeds request
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const signature = await this.generateSignature();
    return {
      'Api-Key': this.apiKey,
      'X-Signature': signature,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    };
  }

  /**
   * Generic request method with timeout and error handling
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutOverride?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.getHeaders();
    const effectiveTimeout = timeoutOverride || this.timeout;

    console.log(`[HOTELBEDS] ${method} ${path} (timeout: ${effectiveTimeout}ms)`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(effectiveTimeout),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorDetail: any;
      try {
        errorDetail = JSON.parse(responseText);
      } catch {
        errorDetail = { raw: responseText };
      }

      const statusCode = response.status;
      console.error(`[HOTELBEDS] Error ${statusCode}: ${path}`, errorDetail);

      // 400 errors: fix request, don't retry same request
      // 500 errors: restart entire booking flow
      if (statusCode >= 500) {
        throw new HotelbedsError(
          `Server error (${statusCode}): restart booking flow`,
          statusCode,
          errorDetail,
          'SERVER_ERROR'
        );
      }

      throw new HotelbedsError(
        `Request failed (${statusCode}): ${errorDetail?.error?.message || response.statusText}`,
        statusCode,
        errorDetail,
        'CLIENT_ERROR'
      );
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      return responseText as unknown as T;
    }
  }

  /**
   * Check API status / verify credentials
   * GET /hotel-api/1.0/status
   */
  async checkStatus(): Promise<any> {
    return await this.request<any>('GET', '/hotel-api/1.0/status');
  }

  // ========================================================================
  // BOOKING WORKFLOW: Availability → CheckRate → Booking
  // ========================================================================

  /**
   * Step 1: Search hotel availability
   * POST /hotel-api/1.0/hotels
   * Max 2,000 hotel codes per request
   */
  async searchAvailability(params: AvailabilityRequest): Promise<AvailabilityResponse> {
    console.log('[HOTELBEDS] Searching availability...');

    // Enforce max 2000 hotel codes
    if (params.hotels?.hotel && params.hotels.hotel.length > 2000) {
      console.warn('[HOTELBEDS] Truncating hotel codes to 2000 max');
      params.hotels.hotel = params.hotels.hotel.slice(0, 2000);
    }

    const result = await this.request<AvailabilityResponse>(
      'POST',
      '/hotel-api/1.0/hotels',
      params
    );

    console.log(`[HOTELBEDS] Found ${result.hotels?.hotels?.length || 0} hotels`);
    return result;
  }

  /**
   * Step 2: Check rate (ONLY if rateType === 'RECHECK')
   * POST /hotel-api/1.0/checkrates
   * Max 10 rates per call (best practice: 1 rateKey per call)
   * Never parse rateKey - treat as opaque string
   */
  async checkRate(rateKeys: string[]): Promise<CheckRateResponse> {
    console.log(`[HOTELBEDS] Checking rate for ${rateKeys.length} rateKey(s)...`);

    if (rateKeys.length > 10) {
      console.warn('[HOTELBEDS] Truncating to 10 rateKeys max');
      rateKeys = rateKeys.slice(0, 10);
    }

    const body = {
      rooms: rateKeys.map(rateKey => ({ rateKey }))
    };

    return await this.request<CheckRateResponse>(
      'POST',
      '/hotel-api/1.0/checkrates',
      body
    );
  }

  /**
   * Step 3: Create booking (ONLY if rateType === 'BOOKABLE')
   * POST /hotel-api/1.0/bookings
   * All rooms in a single call, minimum 60 second timeout
   * Never send CheckRate + Booking together
   */
  async createBooking(params: BookingRequest): Promise<BookingResponse> {
    console.log('[HOTELBEDS] Creating booking...');

    // CERTIFICATION: Minimum 60 second timeout for bookings
    return await this.request<BookingResponse>(
      'POST',
      '/hotel-api/1.0/bookings',
      params,
      60000 // 60 seconds minimum
    );
  }

  /**
   * Get booking detail by reference
   * GET /hotel-api/1.0/bookings/{reference}
   */
  async getBookingDetail(reference: string): Promise<BookingDetailResponse> {
    console.log(`[HOTELBEDS] Getting booking detail: ${reference}`);

    return await this.request<BookingDetailResponse>(
      'GET',
      `/hotel-api/1.0/bookings/${encodeURIComponent(reference)}`
    );
  }

  /**
   * Cancel booking by reference
   * DELETE /hotel-api/1.0/bookings/{reference}
   */
  async cancelBooking(reference: string): Promise<CancelBookingResponse> {
    console.log(`[HOTELBEDS] Cancelling booking: ${reference}`);

    return await this.request<CancelBookingResponse>(
      'DELETE',
      `/hotel-api/1.0/bookings/${encodeURIComponent(reference)}`
    );
  }

  // ========================================================================
  // HOTEL SEARCH (for Phase 1 integration)
  // ========================================================================

  /**
   * Search hotels and map to HotelData format
   * Wraps searchAvailability with response mapping
   */
  async searchHotels(params: {
    destinationCode: string;
    checkinDate: string;
    checkoutDate: string;
    adults: number;
    children: number;
    childrenAges: number[];
    infants: number;
    hotelName?: string;
  }): Promise<{ results: any[]; total: number }> {
    console.log(`[HOTELBEDS] searchHotels: ${params.destinationCode}, ${params.checkinDate}-${params.checkoutDate}`);

    // Build occupancy
    const paxes: Array<{ type: string; age?: number }> = [];

    for (let i = 0; i < params.adults; i++) {
      paxes.push({ type: 'AD' });
    }

    for (const age of params.childrenAges) {
      paxes.push({ type: 'CH', age });
    }

    // Infants as children age 1
    for (let i = 0; i < params.infants; i++) {
      paxes.push({ type: 'CH', age: 1 });
    }

    const availRequest: AvailabilityRequest = {
      stay: {
        checkIn: params.checkinDate,
        checkOut: params.checkoutDate,
      },
      occupancies: [{
        rooms: 1,
        adults: params.adults,
        children: params.childrenAges.length + params.infants,
        paxes,
      }],
      destination: {
        code: params.destinationCode,
      },
    };

    try {
      const response = await this.searchAvailability(availRequest);
      const hotels = response.hotels?.hotels || [];

      // Map to HotelData format
      const mapped = hotels.map(hotel => mapToHotelData(
        hotel,
        params.checkinDate,
        params.checkoutDate,
        params.adults,
        params.children,
        params.infants,
        params.childrenAges
      ));

      // Filter by hotel name if specified
      const filtered = params.hotelName
        ? mapped.filter(h => h.name.toLowerCase().includes(params.hotelName!.toLowerCase()))
        : mapped;

      return { results: filtered, total: filtered.length };
    } catch (error) {
      console.error('[HOTELBEDS] searchHotels failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// RESPONSE MAPPER - Hotelbeds → HotelData
// ============================================================================

function mapToHotelData(
  hotel: any,
  checkinDate: string,
  checkoutDate: string,
  adults: number,
  children: number,
  infants: number,
  childrenAges: number[]
): any {
  const checkin = new Date(checkinDate);
  const checkout = new Date(checkoutDate);
  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

  // Extract star rating from categoryCode (e.g., "4EST" → "4", "5EST" → "5")
  const categoryMatch = hotel.categoryCode?.match(/^(\d)/);
  const category = categoryMatch ? categoryMatch[1] : hotel.categoryCode || '';

  // Map board codes to readable names
  const boardCodeMap: Record<string, string> = {
    'RO': 'Room Only',
    'BB': 'Bed & Breakfast',
    'HB': 'Half Board',
    'FB': 'Full Board',
    'AI': 'All Inclusive',
    'TI': 'Soft All Inclusive',
  };

  // Map rooms from all available rates
  const rooms = (hotel.rooms || []).flatMap((room: any) =>
    (room.rates || []).map((rate: any) => {
      const boardName = boardCodeMap[rate.boardCode] || rate.boardName || rate.boardCode || 'N/A';
      const totalPrice = parseFloat(rate.net || '0');
      const pricePerNight = nights > 0 ? totalPrice / nights : totalPrice;

      return {
        type: room.code || 'STD',
        description: `${room.name || 'Standard Room'} - ${boardName}`,
        price_per_night: Math.round(pricePerNight * 100) / 100,
        total_price: Math.round(totalPrice * 100) / 100,
        currency: hotel.currency || 'USD',
        availability: rate.allotment || 1,
        occupancy_id: rate.rateKey,
        fare_id_broker: `HB|${rate.rateKey}`,
        adults: rate.adults || adults,
        children: rate.children || children,
        infants: infants,
        // Hotelbeds-specific metadata
        _hb_rateType: rate.rateType, // BOOKABLE or RECHECK
        _hb_rateClass: rate.rateClass,
        _hb_boardCode: rate.boardCode,
        _hb_packaging: rate.packaging || false,
        _hb_cancellationPolicies: rate.cancellationPolicies || [],
        _hb_rateComments: rate.rateComments || '',
        _hb_promotions: rate.promotions || [],
        _hb_offers: rate.offers || [],
      };
    })
  );

  return {
    id: `HB-${hotel.code}`,
    unique_id: `HB|${hotel.code}`,
    name: hotel.name || `Hotel ${hotel.code}`,
    category,
    city: hotel.destinationName || hotel.destinationCode || '',
    address: '',
    phone: '',
    website: '',
    description: '',
    images: hotel.images
      ? hotel.images.map((img: any) => `http://photos.hotelbeds.com/giata/${img.path}`)
      : [],
    rooms,
    check_in: checkinDate,
    check_out: checkoutDate,
    nights,
    policy_cancellation: extractCancellationPolicy(rooms),
    search_adults: adults,
    search_children: children,
    search_infants: infants,
    search_childrenAges: childrenAges,
    provider: 'HOTELBEDS',
  };
}

function extractCancellationPolicy(rooms: any[]): string {
  // Get the first room's cancellation policies
  const policies = rooms[0]?._hb_cancellationPolicies || [];
  if (policies.length === 0) return '';

  return policies
    .map((p: any) => {
      const from = p.from ? new Date(p.from).toLocaleDateString('es-ES') : '';
      const amount = p.amount ? `${p.amount}` : '';
      return `Desde ${from}: ${amount}`;
    })
    .join(' | ');
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

class HotelbedsError extends Error {
  statusCode: number;
  detail: any;
  errorType: 'SERVER_ERROR' | 'CLIENT_ERROR';

  constructor(message: string, statusCode: number, detail: any, errorType: 'SERVER_ERROR' | 'CLIENT_ERROR') {
    super(message);
    this.name = 'HotelbedsError';
    this.statusCode = statusCode;
    this.detail = detail;
    this.errorType = errorType;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface AvailabilityRequest {
  stay: {
    checkIn: string;
    checkOut: string;
  };
  occupancies: Array<{
    rooms: number;
    adults: number;
    children: number;
    paxes: Array<{ type: string; age?: number }>;
  }>;
  destination?: {
    code: string;
  };
  hotels?: {
    hotel: number[];
  };
  filter?: {
    maxHotels?: number;
    maxRooms?: number;
    minRate?: number;
    maxRate?: number;
    maxRatesPerRoom?: number;
    packaging?: boolean;
    paymentType?: string;
    hotelPackage?: string;
    minCategory?: number;
    maxCategory?: number;
  };
}

interface AvailabilityResponse {
  auditData?: {
    processTime: string;
    timestamp: string;
    requestHost: string;
    serverId: string;
    environment: string;
    release: string;
  };
  hotels?: {
    checkIn: string;
    checkOut: string;
    total: number;
    hotels: any[];
  };
}

interface CheckRateResponse {
  auditData?: any;
  hotel?: {
    checkIn: string;
    checkOut: string;
    code: number;
    name: string;
    categoryCode: string;
    destinationCode: string;
    rooms: Array<{
      code: string;
      name: string;
      rates: Array<{
        rateKey: string;
        rateType: string; // Should be 'BOOKABLE' after check
        rateClass: string;
        net: string;
        boardCode: string;
        boardName: string;
        cancellationPolicies: Array<{
          amount: string;
          from: string;
        }>;
        rateComments?: string;
        rateCommentsId?: string;
      }>;
    }>;
    currency: string;
  };
}

interface BookingRequest {
  holder: {
    name: string;
    surname: string;
  };
  rooms: Array<{
    rateKey: string;
    paxes: Array<{
      roomId: number;
      type: string;
      name: string;
      surname: string;
      age?: number;
    }>;
  }>;
  clientReference: string;
  tolerance?: number;
  remark?: string;
}

interface BookingResponse {
  auditData?: any;
  booking?: {
    reference: string;
    clientReference: string;
    creationDate: string;
    status: string;
    modificationPolicies?: {
      cancellation: boolean;
      modification: boolean;
    };
    creationUser?: string;
    holder: {
      name: string;
      surname: string;
    };
    hotel: {
      checkOut: string;
      checkIn: string;
      code: number;
      name: string;
      categoryCode: string;
      destinationCode: string;
      destinationName: string;
      latitude: string;
      longitude: string;
      rooms: any[];
      totalNet: string;
      currency: string;
      supplier?: {
        name: string;
        vatNumber: string;
      };
    };
    invoiceCompany?: {
      code: string;
      company: string;
      registrationNumber: string;
    };
    totalNet: string;
    pendingAmount: string;
    currency: string;
  };
}

interface BookingDetailResponse {
  auditData?: any;
  booking?: BookingResponse['booking'];
}

interface CancelBookingResponse {
  auditData?: any;
  booking?: {
    reference: string;
    cancellationReference: string;
    clientReference: string;
    status: string;
    hotel: any;
  };
}

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabase,
    { action: 'search', resource: 'hotelbeds' },
    async () => {
      try {
        console.log(`[HOTELBEDS] Edge Function - ${req.method} ${req.url}`);

        const HOTELBEDS_API_KEY = Deno.env.get('HOTELBEDS_API_KEY');
        const HOTELBEDS_SECRET = Deno.env.get('HOTELBEDS_SECRET');
        const HOTELBEDS_BASE_URL = Deno.env.get('HOTELBEDS_BASE_URL') || 'https://api.test.hotelbeds.com';

        if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
          throw new Error('Hotelbeds credentials not configured in Supabase secrets');
        }

        const client = new HotelbedsApiClient({
          apiKey: HOTELBEDS_API_KEY,
          secret: HOTELBEDS_SECRET,
          baseUrl: HOTELBEDS_BASE_URL,
        });

        const requestBody = await req.json();
        const { action, data } = requestBody;
        console.log(`[HOTELBEDS] Action: ${action}`);

        let result;

        switch (action) {
          case 'searchHotels': {
            // Phase 1 integration: search and map to HotelData
            const destCode = resolveHotelbedsDestination(data.cityCode || data.destination || '');
            result = await client.searchHotels({
              destinationCode: destCode,
              checkinDate: data.checkinDate,
              checkoutDate: data.checkoutDate,
              adults: data.adults || 2,
              children: data.children || 0,
              childrenAges: data.childrenAges || [],
              infants: data.infants || 0,
              hotelName: data.hotelName || '',
            });
            break;
          }

          case 'searchAvailability': {
            result = await client.searchAvailability(data);
            break;
          }

          case 'checkRate': {
            const rateKeys = Array.isArray(data.rateKeys) ? data.rateKeys : [data.rateKey];
            result = await client.checkRate(rateKeys);
            break;
          }

          case 'createBooking': {
            result = await client.createBooking(data);
            break;
          }

          case 'getBookingDetail': {
            result = await client.getBookingDetail(data.reference);
            break;
          }

          case 'cancelBooking': {
            result = await client.cancelBooking(data.reference);
            break;
          }

          case 'testConnection': {
            // Quick status check to verify credentials
            const statusResult = await client.checkStatus();
            result = {
              status: 'connected',
              message: 'Hotelbeds API connection successful',
              apiStatus: statusResult,
            };
            break;
          }

          default:
            throw new Error(`Unsupported action: ${action}`);
        }

        return new Response(JSON.stringify({
          success: true,
          data: result,
          provider: 'HOTELBEDS',
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[HOTELBEDS] Error:', error);

        const isServerError = error instanceof HotelbedsError && error.errorType === 'SERVER_ERROR';

        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          errorType: isServerError ? 'SERVER_ERROR' : 'CLIENT_ERROR',
          detail: error instanceof HotelbedsError ? error.detail : undefined,
          provider: 'HOTELBEDS',
          timestamp: new Date().toISOString(),
        }), {
          status: error instanceof HotelbedsError ? error.statusCode : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  );
});

// Helper: get a test date N days from now (ISO format YYYY-MM-DD)
function getTestDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
