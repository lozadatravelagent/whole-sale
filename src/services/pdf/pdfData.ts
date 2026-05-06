import type { FlightData, HotelData, HotelDataWithSelectedRoom } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export interface AgencyBrandingData {
  agency_name: string;
  agency_logo_url: string;
  agency_primary_color: string;
  agency_secondary_color: string;
  agency_contact_name: string;
  agency_contact_email: string;
  agency_contact_phone: string;
  pdf_footer_text?: string;
  pdf_header_bg_color?: string;
  pdf_footer_bg_color?: string;
}

export async function fetchAgencyBranding(agencyId?: string): Promise<AgencyBrandingData | null> {
  if (!agencyId) return null;
  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('name, branding')
      .eq('id', agencyId)
      .single();
    if (error || !data) {
      console.warn('[PDF] Could not fetch agency branding:', error?.message);
      return null;
    }
    const branding = (data as any).branding || {};
    return {
      agency_name: data.name || '',
      agency_logo_url: branding.logoUrl || branding.logo_url || '',
      agency_primary_color: branding.primaryColor || branding.primary_color || '#333333',
      agency_secondary_color: branding.secondaryColor || branding.secondary_color || '#666666',
      agency_contact_name: branding.contact?.name || branding.contact_name || '',
      agency_contact_email: branding.contact?.email || branding.contact_email || '',
      agency_contact_phone: branding.contact?.phone || branding.contact_phone || '',
      pdf_footer_text: branding.pdfFooterText || '',
      pdf_header_bg_color: branding.pdfHeaderBgColor || '',
      pdf_footer_bg_color: branding.pdfFooterBgColor || ''
    };
  } catch (err) {
    console.error('[PDF] Error fetching agency branding:', err);
    return null;
  }
}

export function analyzeFlightStructure(flights: FlightData[]): {
  templateType: 'flights' | 'flights2';
  description: string;
} {
  if (flights.length >= 2) {
    return {
      templateType: 'flights2',
      description: `Multiple flights (${flights.length} flight options selected)`
    };
  }

  if (flights.length === 1) {
    const flight = flights[0];
    const isRoundTrip = flight.departure_date !== flight.return_date;
    const hasMultipleLegs = (flight.legs?.length || 0) > 1;
    const isComplexJourney = hasMultipleLegs && flight.legs.some(leg =>
      leg.departure.city_code !== flight.legs[0].departure.city_code ||
      leg.arrival.city_code !== flight.legs[flight.legs.length - 1].arrival.city_code
    );
    const hasLayovers = flight.legs.some(leg => leg.layovers && leg.layovers.length > 0);
    const isComplexFlight = isRoundTrip || hasMultipleLegs || hasLayovers || isComplexJourney;

    if (isComplexFlight) {
      return {
        templateType: 'flights2',
        description: 'Complex single flight (round trip, multi-leg, or with layovers)'
      };
    }

    return {
      templateType: 'flights',
      description: 'Simple single flight (one-way or simple round trip)'
    };
  }

  return {
    templateType: 'flights',
    description: 'Default template (fallback)'
  };
}

// Convert price to European format (1577.18 -> "1.577,18")
function formatPriceForTemplate(price: number | string): string {
  let numPrice: number;
  if (typeof price === 'string') {
    const cleaned = price
      .replace(/[^\d.,]/g, '')
      .replace(/\.(?=.*,)/g, '')
      .replace(',', '.');
    numPrice = parseFloat(cleaned);
  } else {
    numPrice = price;
  }
  if (isNaN(numPrice) || numPrice < 0) return '0,00';
  numPrice = Math.round(numPrice * 100) / 100;
  return numPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractMealPlan(roomDescription?: string, hotelData?: any): string | null {
  const desc = (roomDescription || '').toLowerCase();
  const hotelName = (hotelData?.name || '').toLowerCase();
  const hotelDesc = (hotelData?.description || '').toLowerCase();
  const roomDesc = ((hotelData?.roomDescription) || '').toLowerCase();
  const combinedText = `${desc} ${hotelName} ${hotelDesc} ${roomDesc}`;

  if (/todo\s*incluid[oa]?|all\s*inclusive|ai\b|ti\b|incluye\s*todo/i.test(combinedText)) return 'all_inclusive';
  if (/pensión?\s*completa|full\s*board|fb\b|pc\b|fap\b/i.test(combinedText)) return 'full_board';
  if (/media\s*pensión?|half\s*board|hb\b|mp\b|map\b/i.test(combinedText)) return 'half_board';
  if (/desayuno|breakfast|bb\b|bed\s*&?\s*breakfast|continental/i.test(combinedText)) return 'breakfast';
  if (/solo\s*habitación?|room\s*only|ro\b|sin\s*comidas|ep\b/i.test(combinedText)) return 'room_only';
  return null;
}

function extractStars(category: string | undefined, hotelName?: string): string {
  if (category && category.trim()) {
    const halfMatch = category.match(/H(\d+)_5/i);
    if (halfMatch) return String(parseInt(halfMatch[1]) + 1);

    const match = category.match(/^(\d+)/);
    if (match) return match[1];

    const anyMatch = category.match(/(\d+)/);
    if (anyMatch) return anyMatch[1];
  }

  if (hotelName) {
    const nameMatch = hotelName.match(/(\d+)\s*(?:estrellas?|stars?|\*)/i);
    if (nameMatch) return nameMatch[1];
  }

  return '';
}

type HotelPdfInput = (HotelData | HotelDataWithSelectedRoom) & {
  segmentId?: string;
  segmentCity?: string;
  segmentCheckIn?: string;
  segmentCheckOut?: string;
  segmentOrder?: number;
};

function formatPdfCityLabel(city?: string): string {
  if (!city) return 'Destino';
  const lowerJoiners = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
  return city
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && lowerJoiners.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatPdfMealPlanLabel(mealPlan?: string | null): string | null {
  switch (mealPlan) {
    case 'all_inclusive': return 'All Inclusive';
    case 'breakfast': return 'Desayuno';
    case 'half_board': return 'Media pensión';
    case 'full_board': return 'Pensión completa';
    case 'room_only': return 'Solo habitación';
    default: return mealPlan ? mealPlan.replace(/_/g, ' ') : null;
  }
}

function formatPdfShortDateLabel(date?: string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${shortMonths[month - 1] || ''}`.trim();
}

export function preparePdfData(flights: FlightData[], brandingData?: AgencyBrandingData | null) {
  const selected_flights = flights.map((flight, index) => {
    const processedLegs = flight.legs.map((leg, legIndex) => ({
      departure: {
        city_code: leg.departure.city_code,
        city_name: leg.departure.city_name,
        time: leg.departure.time
      },
      arrival: {
        city_code: leg.arrival.city_code,
        city_name: leg.arrival.city_name,
        time: leg.arrival.time
      },
      duration: leg.duration,
      flight_type: leg.flight_type || (legIndex === 0 ? 'outbound' : 'return'),
      layovers: leg.layovers?.map(layover => ({
        waiting_time: layover.waiting_time,
        destination_city: layover.destination_city,
        destination_code: layover.destination_code
      })) || []
    }));

    let finalLegs = processedLegs;
    if (processedLegs.length === 1 && flight.return_date && flight.return_date !== flight.departure_date) {
      const outboundLeg = processedLegs[0];
      const returnLeg = {
        departure: {
          city_code: outboundLeg.arrival.city_code,
          city_name: outboundLeg.arrival.city_name,
          time: outboundLeg.arrival.time
        },
        arrival: {
          city_code: outboundLeg.departure.city_code,
          city_name: outboundLeg.departure.city_name,
          time: outboundLeg.departure.time
        },
        duration: outboundLeg.duration,
        flight_type: 'return',
        layovers: []
      };
      finalLegs = [outboundLeg, returnLeg];
    }

    return {
      airline: { code: flight.airline.code, name: flight.airline.name },
      departure_date: flight.departure_date,
      return_date: flight.return_date || flight.departure_date,
      luggage: flight.luggage || false,
      adults: flight.adults,
      childrens: flight.childrens,
      legs: finalLegs,
      price: {
        amount: formatPriceForTemplate(flight.price.amount),
        currency: flight.price.currency
      },
      travel_assistance: flight.travel_assistance?.included ? 1 : 0,
      transfers: flight.transfers?.included ? 1 : 0
    };
  });

  let hasTravelAssistance = false;
  let hasTransfers = false;
  flights.forEach(flight => {
    if (flight.travel_assistance?.included) hasTravelAssistance = true;
    if (flight.transfers?.included) hasTransfers = true;
  });

  return {
    selected_flights,
    travel_assistance: hasTravelAssistance ? 1 : 0,
    transfers: hasTransfers ? 1 : 0,
    agency_name: brandingData?.agency_name || '',
    agency_logo_url: brandingData?.agency_logo_url || '',
    agency_primary_color: brandingData?.agency_primary_color || '#333333',
    agency_secondary_color: brandingData?.agency_secondary_color || '#666666',
    agency_contact_name: brandingData?.agency_contact_name || '',
    agency_contact_email: brandingData?.agency_contact_email || '',
    agency_contact_phone: brandingData?.agency_contact_phone || ''
  };
}

export function prepareCombinedPdfData(
  flights: FlightData[],
  hotels: HotelData[] | HotelDataWithSelectedRoom[],
  isPriceModified: boolean = false,
  brandingData?: AgencyBrandingData | null
) {
  const normalizedHotels = hotels as HotelPdfInput[];

  const selected_flights = flights.map(flight => ({
    airline: { code: flight.airline.code, name: flight.airline.name },
    departure_date: flight.departure_date,
    return_date: flight.return_date || flight.departure_date,
    luggage: flight.luggage || false,
    adults: flight.adults,
    childrens: flight.childrens,
    legs: flight.legs.map(leg => ({
      departure: {
        city_code: leg.departure.city_code,
        city_name: leg.departure.city_name,
        time: leg.departure.time
      },
      arrival: {
        city_code: leg.arrival.city_code,
        city_name: leg.arrival.city_name,
        time: leg.arrival.time
      },
      duration: leg.duration,
      flight_type: leg.flight_type,
      layovers: leg.layovers?.map(layover => ({
        waiting_time: layover.waiting_time || layover.duration || '',
        destination_city: layover.destination_city || layover.airport?.city || '',
        destination_code: layover.destination_code || layover.airport?.code || ''
      })) || []
    })),
    price: {
      amount: formatPriceForTemplate(flight.price.amount),
      currency: flight.price.currency
    },
    travel_assistance: flight.travel_assistance?.included ? 1 : 0,
    transfers: flight.transfers?.included ? 1 : 0
  }));

  const best_hotels = normalizedHotels.map(hotel => {
    const extractedStars = extractStars(hotel.category, hotel.name);

    let location = hotel.city || '';
    if (hotel.address && hotel.address.trim()) {
      if (hotel.city && hotel.city.trim()) {
        location = `${hotel.address.trim()}, ${hotel.city.trim()}`;
      } else {
        location = hotel.address.trim();
      }
    }
    if (location.length > 20) location = location.substring(0, 20).trim();

    const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
    const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );

    const priceForAllNights = roomToUse.total_price;

    const hotelForTemplate: any = {
      name: hotel.name,
      stars: extractedStars,
      location: location || hotel.city || 'Ubicación no especificada',
      roomDescription:
        roomToUse.description ||
        (hotel as any).roomDescription ||
        (hotel as any).roomType ||
        hotel.description ||
        '',
      price: formatPriceForTemplate(priceForAllNights),
      link: `https://wholesale-connect.com/hotel/${hotel.id}`
    };

    if ((hotel as any).mealPlan) {
      hotelForTemplate.mealPlan = formatPdfMealPlanLabel((hotel as any).mealPlan);
    }
    if ((hotel as any).optionNumber !== undefined) {
      hotelForTemplate.optionNumber = (hotel as any).optionNumber;
    }
    if ((hotel as any)._packageMetadata) {
      hotelForTemplate._packageMetadata = (hotel as any)._packageMetadata;
    }

    return hotelForTemplate;
  });

  const hotelSegmentsMap = new Map<string, {
    segment_id: string;
    city: string;
    checkin: string;
    checkout: string;
    nights: number;
    adults: number;
    children: number;
    infants: number;
    hotels: Array<{
      name: string;
      stars: string;
      location: string;
      roomDescription?: string;
      mealPlan?: string | null;
      price: string;
      rawPrice?: number;
      currency?: string;
    }>;
    order: number;
  }>();

  normalizedHotels.forEach((hotel, index) => {
    if (!hotel.segmentId && !hotel.segmentCity && !hotel.segmentCheckIn && !hotel.segmentCheckOut) {
      return;
    }

    const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
    const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );
    const templateHotel = best_hotels[index];
    const segmentCity = hotel.segmentCity || hotel.city || 'Destino';
    const segmentCheckIn = hotel.segmentCheckIn || hotel.check_in;
    const segmentCheckOut = hotel.segmentCheckOut || hotel.check_out;
    const segmentGroupingKey = `${segmentCity.toLowerCase()}|${segmentCheckIn}|${segmentCheckOut}`;
    const segmentId = hotel.segmentId || segmentGroupingKey;
    const segmentOrder = hotel.segmentOrder ?? hotelSegmentsMap.size;

    if (!hotelSegmentsMap.has(segmentGroupingKey)) {
      hotelSegmentsMap.set(segmentGroupingKey, {
        segment_id: segmentId,
        city: formatPdfCityLabel(segmentCity),
        checkin: segmentCheckIn,
        checkout: segmentCheckOut,
        nights: hotel.nights,
        adults: hotel.search_adults ?? flights[0]?.adults ?? 1,
        children: hotel.search_children ?? flights[0]?.childrens ?? 0,
        infants: hotel.search_infants ?? flights[0]?.infants ?? 0,
        hotels: [],
        order: segmentOrder
      });
    }

    hotelSegmentsMap.get(segmentGroupingKey)!.hotels.push({
      name: templateHotel.name,
      stars: templateHotel.stars,
      location: templateHotel.location || hotel.city || 'Ubicación no especificada',
      roomDescription: templateHotel.roomDescription || '',
      mealPlan: (templateHotel as any).mealPlan || formatPdfMealPlanLabel(extractMealPlan(roomToUse?.description, hotel)),
      price: templateHotel.price,
      rawPrice: roomToUse?.total_price,
      currency: roomToUse?.currency
    });
  });

  const hotel_segments = Array.from(hotelSegmentsMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...segment }) => segment);
  const hasHotelSegments = hotel_segments.length > 0;
  const hotel_summary_cards = Array.from(hotelSegmentsMap.values())
    .sort((a, b) => a.order - b.order)
    .flatMap((segment, segmentIndex) => segment.hotels.map((hotel, hotelIndex) => ({
      card_id: `${segment.segment_id}-${hotelIndex + 1}`,
      city: segment.city,
      checkin: segment.checkin,
      checkout: segment.checkout,
      short_dates: `${formatPdfShortDateLabel(segment.checkin)} - ${formatPdfShortDateLabel(segment.checkout)}`,
      nights: segment.nights,
      adults: segment.adults,
      children: segment.children,
      infants: segment.infants,
      hotel_name: hotel.name,
      stars: hotel.stars,
      location: hotel.location,
      room_description: hotel.roomDescription || '',
      meal_plan: hotel.mealPlan || null,
      price: hotel.price,
      currency: hotel.currency || 'USD',
      segment_order: segmentIndex,
      hotel_order: hotelIndex
    })))
    .slice(0, 4);

  const firstHotel = normalizedHotels[0];
  const firstFlight = flights[0];

  const checkin = hasHotelSegments
    ? hotel_segments[0]?.checkin || firstHotel?.check_in || firstFlight?.departure_date || new Date().toISOString().split('T')[0]
    : firstHotel?.check_in || firstFlight?.departure_date || new Date().toISOString().split('T')[0];
  const checkout = hasHotelSegments
    ? hotel_segments[hotel_segments.length - 1]?.checkout || firstHotel?.check_out || firstFlight?.return_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
    : firstHotel?.check_out || firstFlight?.return_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

  const hasFlights = flights.length > 0;

  let adults = 1;
  let childrens = 0;
  let infants = 0;

  if (firstFlight) {
    adults = firstFlight.adults ?? 1;
    childrens = firstFlight.childrens ?? 0;
    infants = firstFlight.infants ?? 0;
  } else if (firstHotel) {
    adults = hasHotelSegments ? hotel_segments[0]?.adults ?? firstHotel.search_adults ?? 1 : firstHotel.search_adults ?? 1;
    childrens = hasHotelSegments ? hotel_segments[0]?.children ?? firstHotel.search_children ?? 0 : firstHotel.search_children ?? 0;
    infants = hasHotelSegments ? hotel_segments[0]?.infants ?? firstHotel.search_infants ?? 0 : firstHotel.search_infants ?? 0;
  }

  let totalFlightPrice = 0;
  let totalHotelPrice = 0;

  flights.forEach(flight => {
    const flightPrice = typeof flight.price.amount === 'string' ? parseFloat(flight.price.amount) : flight.price.amount;
    totalFlightPrice += flightPrice || 0;
  });

  normalizedHotels.forEach(hotel => {
    const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
    const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
      room.total_price < cheapest.total_price ? room : cheapest
    );
    totalHotelPrice += (roomToUse.total_price) || 0;
  });

  const totalPrice = totalFlightPrice + totalHotelPrice;
  const currency = firstFlight?.price?.currency || 'USD';

  let hasTravelAssistance = false;
  let hasTransfers = false;
  flights.forEach(flight => {
    if (flight.travel_assistance?.included) hasTravelAssistance = true;
    if (flight.transfers?.included) hasTransfers = true;
  });

  const hasMultipleHotels = !hasHotelSegments && normalizedHotels.length >= 2;
  let option1Hotel: any = null;
  let option2Hotel: any = null;
  let option3Hotel: any = null;
  let option1Total = 0;
  let option2Total = 0;
  let option3Total = 0;

  if (hasMultipleHotels) {
    const hasPackageMetadata = best_hotels.some((h: any) => h._packageMetadata);

    if (hasPackageMetadata) {
      const option1Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 1);
      const option2Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 2);
      const option3Data = best_hotels.find((h: any) => h._packageMetadata?.optionNumber === 3);

      if (option1Data && option2Data) {
        option1Total = option1Data._packageMetadata.totalPackagePrice;
        option2Total = option2Data._packageMetadata.totalPackagePrice;

        const option1HotelPrice = typeof option1Data.price === 'string'
          ? parseFloat(option1Data.price.replace(/\./g, '').replace(',', '.'))
          : option1Data.price;
        const option2HotelPrice = typeof option2Data.price === 'string'
          ? parseFloat(option2Data.price.replace(/\./g, '').replace(',', '.'))
          : option2Data.price;

        const option1Name = option1Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');
        const option2Name = option2Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');

        option1Hotel = {
          name: option1Name,
          stars: option1Data.stars || extractStars(option1Data.category, option1Name),
          location: (option1Data.location || option1Data.city || 'Ubicación no especificada').substring(0, 20),
          roomDescription: option1Data.roomDescription || '',
          price: formatPriceForTemplate(option1HotelPrice)
        };
        option2Hotel = {
          name: option2Name,
          stars: option2Data.stars || extractStars(option2Data.category, option2Name),
          location: (option2Data.location || option2Data.city || 'Ubicación no especificada').substring(0, 20),
          roomDescription: option2Data.roomDescription || '',
          price: formatPriceForTemplate(option2HotelPrice)
        };

        if (option3Data) {
          option3Total = option3Data._packageMetadata.totalPackagePrice;
          const option3HotelPrice = typeof option3Data.price === 'string'
            ? parseFloat(option3Data.price.replace(/\./g, '').replace(',', '.'))
            : option3Data.price;
          const option3Name = option3Data.name.replace(/\s*\(Opción\s+\d+\)/i, '');
          option3Hotel = {
            name: option3Name,
            stars: option3Data.stars || extractStars(option3Data.category, option3Name),
            location: (option3Data.location || option3Data.city || 'Ubicación no especificada').substring(0, 20),
            roomDescription: option3Data.roomDescription || '',
            price: formatPriceForTemplate(option3HotelPrice)
          };
        }
      }
    } else {
      const sortedHotels = [...best_hotels].sort((a, b) => {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price.replace(/\./g, '').replace(',', '.')) : a.price;
        const priceB = typeof b.price === 'string' ? parseFloat(b.price.replace(/\./g, '').replace(',', '.')) : b.price;
        return priceA - priceB;
      });

      const cheapestHotel = sortedHotels[0];
      const mostExpensiveHotel = sortedHotels[sortedHotels.length - 1];

      const cheapestPrice = typeof cheapestHotel.price === 'string'
        ? parseFloat(cheapestHotel.price.replace(/\./g, '').replace(',', '.'))
        : cheapestHotel.price;
      const expensivePrice = typeof mostExpensiveHotel.price === 'string'
        ? parseFloat(mostExpensiveHotel.price.replace(/\./g, '').replace(',', '.'))
        : mostExpensiveHotel.price;

      option1Total = totalFlightPrice + cheapestPrice;
      option2Total = totalFlightPrice + expensivePrice;

      option1Hotel = {
        name: cheapestHotel.name,
        stars: cheapestHotel.stars,
        location: cheapestHotel.city || cheapestHotel.location,
        roomDescription: cheapestHotel.roomDescription || '',
        price: cheapestHotel.price
      };
      option2Hotel = {
        name: mostExpensiveHotel.name,
        stars: mostExpensiveHotel.stars,
        location: mostExpensiveHotel.city || mostExpensiveHotel.location,
        roomDescription: mostExpensiveHotel.roomDescription || '',
        price: mostExpensiveHotel.price
      };

      if (sortedHotels.length >= 3) {
        const middleIndex = Math.floor(sortedHotels.length / 2);
        const middleHotel = sortedHotels[middleIndex];
        const middlePrice = typeof middleHotel.price === 'string'
          ? parseFloat(middleHotel.price.replace(/\./g, '').replace(',', '.'))
          : middleHotel.price;
        option3Total = totalFlightPrice + middlePrice;
        option3Hotel = {
          name: middleHotel.name,
          stars: middleHotel.stars,
          location: middleHotel.city || middleHotel.location,
          roomDescription: middleHotel.roomDescription || '',
          price: middleHotel.price
        };
      }
    }
  } else if (!hasHotelSegments && normalizedHotels.length === 1) {
    const singleHotel = best_hotels[0];
    option1Hotel = {
      name: singleHotel.name,
      stars: singleHotel.stars,
      location: (singleHotel.location || singleHotel.city || 'Ubicación no especificada').substring(0, 20),
      roomDescription: singleHotel.roomDescription || '',
      price: singleHotel.price
    };
    option1Total = totalPrice;
  }

  const hotelDestination = hasHotelSegments
    ? Array.from(new Set(hotel_segments.map(segment => segment.city))).join(' / ')
    : formatPdfCityLabel(firstHotel?.city || firstHotel?.address?.split(',')[0] || 'Destino');

  let mealPlan: string | null = null;
  if (firstHotel) {
    const hotelWithRoom = firstHotel as HotelDataWithSelectedRoom;
    const roomToCheck = hotelWithRoom.selectedRoom || firstHotel.rooms?.[0];
    mealPlan = formatPdfMealPlanLabel(extractMealPlan(roomToCheck?.description, firstHotel));
  }

  return {
    selected_flights,
    best_hotels,
    has_flights: hasFlights,
    hotel_destination: hotelDestination,
    hotel_destinations_summary: hotelDestination,
    has_hotel_segments: hasHotelSegments,
    hotel_segments,
    hotel_segments_count: hotel_segments.length,
    hotel_summary_cards,
    checkin,
    checkout,
    adults,
    childrens,
    infants,
    total_price: formatPriceForTemplate(totalPrice),
    total_currency: currency,
    flight_price: formatPriceForTemplate(totalFlightPrice),
    hotel_price: formatPriceForTemplate(totalHotelPrice),
    travel_assistance: hasTravelAssistance ? 1 : 0,
    transfers: hasTransfers ? 1 : 0,
    has_multiple_hotels: hasMultipleHotels,
    hotel_options_count: normalizedHotels.length,
    option_1_hotel: option1Hotel,
    option_1_total: option1Hotel ? formatPriceForTemplate(option1Total) : null,
    option_2_hotel: option2Hotel,
    option_2_total: option2Hotel ? formatPriceForTemplate(option2Total) : null,
    option_3_hotel: option3Hotel,
    option_3_total: option3Hotel ? formatPriceForTemplate(option3Total) : null,
    is_price_modified: isPriceModified,
    meal_plan: mealPlan,
    agency_name: brandingData?.agency_name || '',
    agency_logo_url: brandingData?.agency_logo_url || '',
    agency_primary_color: brandingData?.agency_primary_color || '#333333',
    agency_secondary_color: brandingData?.agency_secondary_color || '#666666',
    agency_contact_name: brandingData?.agency_contact_name || '',
    agency_contact_email: brandingData?.agency_contact_email || '',
    agency_contact_phone: brandingData?.agency_contact_phone || ''
  };
}
