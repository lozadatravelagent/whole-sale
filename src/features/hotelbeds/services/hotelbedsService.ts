import { supabase } from '@/integrations/supabase/client';

/**
 * Frontend service for calling the Hotelbeds Edge Function.
 * Maps to the certification workflow: Availability → CheckRate → Booking → Voucher
 */

export interface HotelbedsSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childrenAges: number[];
  rooms?: number;
}

export interface HotelbedsAvailabilityResult {
  hotels: HotelbedsHotel[];
  checkIn: string;
  checkOut: string;
  total: number;
}

export interface HotelbedsHotel {
  code: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  destinationCode: string;
  destinationName: string;
  latitude: string;
  longitude: string;
  currency: string;
  rooms: HotelbedsRoom[];
  minRate: string;
  maxRate: string;
  images?: Array<{ path: string }>;
}

export interface HotelbedsRoom {
  code: string;
  name: string;
  rates: HotelbedsRate[];
}

export interface HotelbedsRate {
  rateKey: string;
  rateType: 'BOOKABLE' | 'RECHECK';
  rateClass: string;
  net: string;
  sellingRate?: string;
  boardCode: string;
  boardName: string;
  rooms: number;
  adults: number;
  children: number;
  allotment: number;
  cancellationPolicies?: Array<{
    amount: string;
    from: string;
  }>;
  rateComments?: string;
  rateCommentsId?: string;
  packaging?: boolean;
  promotions?: Array<{
    code: string;
    name: string;
    remark?: string;
  }>;
  offers?: Array<{
    code: string;
    name: string;
    amount: string;
  }>;
}

export interface HotelbedsCheckRateResult {
  hotel: {
    checkIn: string;
    checkOut: string;
    code: number;
    name: string;
    categoryCode: string;
    destinationCode: string;
    rooms: Array<{
      code: string;
      name: string;
      rates: HotelbedsRate[];
    }>;
    currency: string;
  };
}

export interface HotelbedsBookingParams {
  rateKey: string;
  holderName: string;
  holderSurname: string;
  paxes: Array<{
    roomId: number;
    type: 'AD' | 'CH';
    name: string;
    surname: string;
    age?: number;
  }>;
  clientReference: string;
  remark?: string;
  tolerance?: number;
}

export interface HotelbedsBookingResult {
  booking: {
    reference: string;
    clientReference: string;
    creationDate: string;
    status: string;
    holder: { name: string; surname: string };
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
      rooms: Array<{
        code: string;
        name: string;
        rates: HotelbedsRate[];
        paxes: Array<{
          roomId: number;
          type: string;
          name: string;
          surname: string;
          age?: number;
        }>;
      }>;
      totalNet: string;
      currency: string;
      supplier?: { name: string; vatNumber: string };
    };
    invoiceCompany?: { code: string; company: string; registrationNumber: string };
    totalNet: string;
    pendingAmount: string;
    currency: string;
    modificationPolicies?: { cancellation: boolean; modification: boolean };
  };
}

export interface HotelbedsCancelResult {
  booking: {
    reference: string;
    cancellationReference: string;
    clientReference: string;
    status: string;
  };
}

// Board code → full label map
export const BOARD_LABELS: Record<string, string> = {
  'RO': 'Room Only',
  'BB': 'Bed & Breakfast',
  'HB': 'Half Board',
  'FB': 'Full Board',
  'AI': 'All Inclusive',
  'TI': 'Soft All Inclusive',
};

async function callHotelbeds<T>(action: string, data: unknown): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke('hotelbeds-api', {
    body: { action, data },
  });

  if (error) {
    throw new Error(`Hotelbeds API error: ${error.message}`);
  }

  if (!result?.success) {
    throw new Error(result?.error || 'Unknown Hotelbeds API error');
  }

  return result.data as T;
}

export async function searchAvailability(
  params: HotelbedsSearchParams
): Promise<HotelbedsAvailabilityResult> {
  const paxes: Array<{ type: string; age?: number }> = [];
  for (let i = 0; i < params.adults; i++) {
    paxes.push({ type: 'AD' });
  }
  for (const age of params.childrenAges) {
    paxes.push({ type: 'CH', age });
  }

  const requestBody = {
    stay: {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    },
    occupancies: [{
      rooms: params.rooms || 1,
      adults: params.adults,
      children: params.children,
      paxes,
    }],
    destination: {
      code: params.destination,
    },
  };

  const response = await callHotelbeds<{ hotels?: HotelbedsAvailabilityResult }>(
    'searchAvailability',
    requestBody
  );

  return response.hotels || { hotels: [], checkIn: params.checkIn, checkOut: params.checkOut, total: 0 };
}

export async function checkRate(rateKey: string): Promise<HotelbedsCheckRateResult> {
  return await callHotelbeds<HotelbedsCheckRateResult>('checkRate', {
    rateKeys: [rateKey],
  });
}

export async function createBooking(
  params: HotelbedsBookingParams
): Promise<HotelbedsBookingResult> {
  const bookingRequest = {
    holder: {
      name: params.holderName,
      surname: params.holderSurname,
    },
    rooms: [{
      rateKey: params.rateKey,
      paxes: params.paxes,
    }],
    clientReference: params.clientReference,
    tolerance: params.tolerance,
    remark: params.remark,
  };

  return await callHotelbeds<HotelbedsBookingResult>('createBooking', bookingRequest);
}

export async function getBookingDetail(reference: string): Promise<HotelbedsBookingResult> {
  return await callHotelbeds<HotelbedsBookingResult>('getBookingDetail', { reference });
}

export async function cancelBooking(reference: string): Promise<HotelbedsCancelResult> {
  return await callHotelbeds<HotelbedsCancelResult>('cancelBooking', { reference });
}

export async function testConnection(): Promise<{ status: string; message: string }> {
  return await callHotelbeds<{ status: string; message: string }>('testConnection', {});
}
