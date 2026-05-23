import type {
  FlightData,
  LocalHotelData,
  LocalHotelChainBalance,
  LocalHotelSegmentResult,
  LocalCombinedTravelResults,
  LocalServiceData,
} from '@/types/external';
import { generateFlightItinerary } from './flightTransformer';
import { formatDuration } from '../utils/flightHelpers';
import { translateRoomDescription, translateRoomTypeTitle, translateFlightInfo, translateBaggage } from '../utils/translations';
import { LOCALE_BY_LANGUAGE, getChatResultCopy, getResponseFormatterCopy, getTravelerCopy, type UserLanguage } from '@/features/chat/i18n/chatResultCopy';

const formatDateByLanguage = (date: string, language: UserLanguage) =>
  new Date(date).toLocaleDateString(LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.es);

const formatBaggageDetails = (baggageType: string, language: UserLanguage): string => {
  if (language === 'es') return translateBaggage(baggageType);
  if (baggageType.includes('PC') || baggageType.includes('KG')) {
    const match = baggageType.match(/(\d+)PC|(\d+)KG/);
    if (match) {
      const quantity = parseInt(match[1] || match[2]);
      if (quantity > 0) {
        const unit = baggageType.includes('PC')
          ? (language === 'pt' ? 'peça(s)' : 'piece(s)')
          : 'kg';
        return `✅ ${quantity}${baggageType.includes('PC') ? ` ${unit}` : unit} ${getChatResultCopy(language).included}`;
      }
      return `❌ ${getChatResultCopy(language).notIncluded}`;
    }
  }
  return baggageType;
};

const formatFlightText = (text: string, language: UserLanguage) =>
  language === 'es' ? translateFlightInfo(text) : text;

const formatRoomText = (text: string, language: UserLanguage) =>
  language === 'es' ? translateRoomDescription(text) : text;

// Response formatters - using the main FlightData interface
export const formatFlightResponse = (flights: FlightData[], language: UserLanguage = 'es') => {
  const copy = getChatResultCopy(language);
  if (flights.length === 0) {
    return copy.noFlights as string;
  }

  const displayCount = Math.min(flights.length, 5);
  let response = (copy.flightsAvailable as (displayCount: number, total: number) => string)(displayCount, flights.length);

  flights.slice(0, 5).forEach((flight, index) => {
    response += `---\n\n`;
    response += `✈️ **${copy.option as string} ${index + 1}** - ${flight.airline.name} (${flight.airline.code})\n`;

    // Información de precio detallada
    response += `💰 **${copy.totalPrice as string}:** ${flight.price.amount} ${flight.price.currency}\n`;
    if (flight.price.breakdown) {
      response += `   • ${copy.baseFare as string}: ${flight.price.breakdown.fareAmount} ${flight.price.currency}\n`;
      response += `   • ${copy.taxes as string}: ${flight.price.breakdown.taxAmount} ${flight.price.currency}\n`;
      if (flight.price.breakdown.serviceAmount > 0) {
        response += `   • ${copy.services as string}: ${flight.price.breakdown.serviceAmount} ${flight.price.currency}\n`;
      }
      if (flight.price.breakdown.commissionAmount > 0) {
        response += `   • ${copy.commission as string}: ${flight.price.breakdown.commissionAmount} ${flight.price.currency}\n`;
      }
    }

    // Información de fechas y horarios
    response += `🛫 **${copy.departure as string}:** ${flight.departure_date} ${flight.departure_time || ''}\n`;
    response += `🛬 **${copy.arrival as string}:** ${flight.arrival_date} ${flight.arrival_time || ''}\n`;
    if (flight.return_date && flight.trip_type !== 'multi_city') {
      response += `🔄 **${copy.return as string}:** ${flight.return_date}\n`;
    } else if (flight.trip_type === 'multi_city') {
      response += `🗺️ **${copy.type as string}:** Multi-city (${flight.legs?.length || 0})\n`;
    }

    // Duración y escalas
    response += `⏱️ **${copy.duration as string}:** ${flight.duration?.formatted || 'N/A'}\n`;
    response += `🛑 **${copy.type as string}:** ${flight.stops?.direct ? copy.directFlight as string : (copy.withConnections as (count: number) => string)(flight.stops?.count || 0)}\n`;

    // Información de equipaje mejorada
    const baggageDetails = flight.baggage?.details ? formatBaggageDetails(flight.baggage.details, language) : 'N/A';
    response += `🧳 **${copy.checkedBaggage as string}:** ${baggageDetails}\n`;

    // Información de carry-on - detectar inconsistencias en los datos
    let carryOnQuantity = parseInt(flight.baggage?.carryOnQuantity || '0');

    // Fix para datos inconsistentes: si carryOnQuantity es 0 pero los segments tienen carry-on, usar los segments
    if (carryOnQuantity === 0 && flight.legs?.length > 0) {
      const firstSegment = flight.legs[0]?.options?.[0]?.segments?.[0];
      if (firstSegment?.carryOnBagInfo?.quantity) {
        carryOnQuantity = parseInt(firstSegment.carryOnBagInfo.quantity);
      }
    }

    if (carryOnQuantity > 0) {
      response += `🎒 **${copy.carryOn as string}:** ✅ ${carryOnQuantity} ${language === 'en' ? 'piece(s)' : language === 'pt' ? 'peça(s)' : 'pieza(s)'} ${copy.included as string}`;
      if (flight.baggage?.carryOnWeight) {
        response += ` (${flight.baggage.carryOnWeight})`;
      }
      response += '\n';
    } else {
      response += `🎒 **${copy.carryOn as string}:** ❌ ${copy.notIncluded as string}\n`;
    }

    // Clase de cabina
    const cabinClass = flight.cabin?.brandName || flight.cabin?.class || 'Economy';
    const translatedCabinClass = formatFlightText(cabinClass, language);
    response += `💺 **${copy.cabinClass as string}:** ${translatedCabinClass}\n`;

    // Información de reserva
    if (flight.booking?.lastTicketingDate) {
      const ticketingDate = formatDateByLanguage(flight.booking.lastTicketingDate, language);
      response += `📅 **${copy.validUntil as string}:** ${ticketingDate}\n`;
    }

    // Itinerario detallado visual
    const itinerary = generateFlightItinerary(flight, language);
    response += itinerary;

    // FareID para referencia
    response += `\n🆔 **${copy.fareId as string}:** ${flight.id}\n\n`;
  });

  response += `\n${copy.selectFlights as string}`;
  return response;
};

// Nueva función para mostrar información detallada de un vuelo específico
export const getDetailedFlightInfo = (flight: FlightData): string => {
  let info = `🔍 **Información Detallada del Vuelo ${flight.id}**\n\n`;

  // Información básica
  info += `✈️ **Aerolínea:** ${flight.airline.name} (${flight.airline.code})\n`;
  info += `🆔 **FareID:** ${flight.id}\n`;
  info += `🏷️ **Proveedor:** ${flight.provider}\n\n`;

  // Desglose de precios completo
  info += `💰 **Desglose de Precios:**\n`;
  info += `   • Precio Total: ${flight.price.amount} ${flight.price.currency}\n`;
  info += `   • Precio Neto: ${flight.price.netAmount || 0} ${flight.price.currency}\n`;
  info += `   • Tarifa Base: ${flight.price.fareAmount || 0} ${flight.price.currency}\n`;
  info += `   • Tasas Totales: ${flight.price.taxAmount || 0} ${flight.price.currency}\n`;
  if (flight.price.localAmount && flight.price.localCurrency !== flight.price.currency) {
    info += `   • Precio Local: ${flight.price.localAmount} ${flight.price.localCurrency}\n`;
  }

  // Información de pasajeros
  if (flight.passengerFares && flight.passengerFares.length > 0) {
    info += `\n👥 **Desglose por Pasajero:**\n`;
    flight.passengerFares.forEach(paxFare => {
      const paxType = paxFare.passengerType === 'ADT' ? 'Adulto' :
        paxFare.passengerType === 'CHD' ? 'Niño' : 'Infante';
      info += `   • ${paxType} (${paxFare.count}): ${paxFare.totalAmount} ${flight.price.currency}\n`;
      info += `     - Tarifa: ${paxFare.fareAmount} ${flight.price.currency}\n`;
      info += `     - Tasas: ${paxFare.taxAmount} ${flight.price.currency}\n`;
    });
  }

  // Información de tasas detallada
  if (flight.taxes && flight.taxes.length > 0) {
    info += `\n💳 **Detalle de Tasas:**\n`;
    flight.taxes.forEach(tax => {
      info += `   • ${tax.code}: ${tax.amount} ${tax.currency} (${tax.description})\n`;
    });
  }

  // Información de equipaje detallada
  info += `\n🧳 **Equipaje:**\n`;
  info += `   • Incluido: ${flight.baggage?.included ? 'Sí' : 'No'}\n`;
  info += `   • Detalles: ${flight.baggage?.details || 'N/A'}\n`;
  if (flight.baggage?.carryOnQuantity) {
    info += `   • Equipaje de mano: ${flight.baggage.carryOnQuantity} pieza(s)\n`;
    if (flight.baggage.carryOnWeight) {
      info += `   • Peso máximo: ${flight.baggage.carryOnWeight}\n`;
    }
    if (flight.baggage.carryOnDimensions) {
      info += `   • Dimensiones: ${flight.baggage.carryOnDimensions}\n`;
    }
  }

  // Información de reserva detallada
  info += `\n📋 **Información de Reserva:**\n`;
  info += `   • Aerolínea Validadora: ${flight.booking?.validatingCarrier || 'N/A'}\n`;
  info += `   • Tipo de Tarifa: ${flight.booking?.fareType || 'N/A'}\n`;
  info += `   • Proveedor: ${flight.booking?.fareSupplier || 'N/A'}\n`;
  info += `   • Política de Cancelación: ${flight.booking?.cancelPolicy || 'N/A'}\n`;
  if (flight.booking?.maxInstallments && flight.booking.maxInstallments > 0) {
    info += `   • Cuotas Máximas: ${flight.booking.maxInstallments}\n`;
  }
  if (flight.booking?.lastTicketingDate) {
    const ticketingDate = new Date(flight.booking.lastTicketingDate).toLocaleDateString('es-ES');
    info += `   • Válido hasta: ${ticketingDate}\n`;
  }

  // Información de comisión
  if (flight.commission && flight.commission.percentage > 0) {
    info += `\n💼 **Comisión:**\n`;
    info += `   • Porcentaje: ${flight.commission.percentage}%\n`;
    info += `   • Monto: ${flight.commission.amount} ${flight.price.currency}\n`;
    if (flight.commission.over > 0) {
      info += `   • Over: ${flight.commission.over} ${flight.price.currency}\n`;
    }
  }

  // Información detallada de segmentos
  info += `\n🛫 **Itinerario Detallado:**\n`;
  flight.legs.forEach((leg, legIndex) => {
    info += `\n**Tramo ${leg.legNumber}:**\n`;
    leg.options.forEach((option, optionIndex) => {
      info += `  Opción ${optionIndex + 1} (${formatDuration(option.duration)}):\n`;
      option.segments.forEach((segment, segIndex) => {
        info += `    Segmento ${segment.segmentNumber}: ${segment.airline}${segment.flightNumber}\n`;
        info += `    ${segment.departure.airportCode} ${segment.departure.time} → ${segment.arrival.airportCode} ${segment.arrival.time}\n`;
        info += `    Clase: ${segment.cabinClass} (${segment.brandName || 'N/A'})\n`;
        info += `    Equipo: ${segment.equipment || 'N/A'}\n`;
        if (segment.stops.length > 0) {
          info += `    Escalas: ${segment.stops.length}\n`;
        }
      });
    });
  });

  return info;
};

// Función para ordenar habitaciones de manera inteligente
const sortHotelRooms = (rooms: LocalHotelData['rooms']) => {
  // Función para determinar el tipo de habitación y su prioridad
  const getRoomTypePriority = (description: string): { type: string; priority: number } => {
    const desc = description.toLowerCase();

    // Identificar tipo de habitación (English and Spanish)
    if (desc.includes('single') || desc.includes('sgl') || desc.includes('individual')) {
      return { type: 'SGL', priority: 1 };
    } else if ((desc.includes('double') || desc.includes('doble')) && (desc.includes('single use') || desc.includes('uso individual'))) {
      return { type: 'DUS', priority: 2 };
    } else if (desc.includes('double') || desc.includes('doble') || desc.includes('dbl')) {
      return { type: 'DBL', priority: 3 };
    } else if (desc.includes('triple')) {
      return { type: 'TPL', priority: 4 };
    } else if (desc.includes('quad') || desc.includes('cuádruple') || desc.includes('cuadruple') || desc.includes('family') || desc.includes('familiar')) {
      return { type: 'QUA', priority: 5 };
    } else {
      return { type: 'OTHER', priority: 6 };
    }
  };

  // Función para determinar la categoría de la habitación
  const getRoomCategory = (description: string): { category: string; priority: number } => {
    const desc = description.toLowerCase();

    if (desc.includes('superior') || desc.includes('executive')) {
      return { category: 'SUPERIOR', priority: 3 };
    } else if (desc.includes('standard') || desc.includes('estándar')) {
      return { category: 'STANDARD', priority: 2 };
    } else if (desc.includes('comfort') || desc.includes('deluxe')) {
      return { category: 'COMFORT', priority: 4 };
    } else {
      return { category: 'BASIC', priority: 1 };
    }
  };

  // Función para determinar si incluye desayuno
  const hasBreakfast = (description: string): boolean => {
    const desc = description.toLowerCase();
    return desc.includes('breakfast') || desc.includes('desayuno') || desc.includes('bed and breakfast');
  };

  return [...rooms].sort((a, b) => {
    const aType = getRoomTypePriority(a.description || '');
    const bType = getRoomTypePriority(b.description || '');

    const aCategory = getRoomCategory(a.description || '');
    const bCategory = getRoomCategory(b.description || '');

    const aBreakfast = hasBreakfast(a.description || '');
    const bBreakfast = hasBreakfast(b.description || '');

    // 1. Ordenar por tipo de habitación (SGL, DUS, DBL, TPL, QUA)
    if (aType.priority !== bType.priority) {
      return aType.priority - bType.priority;
    }

    // 2. Ordenar por categoría (BASIC, STANDARD, COMFORT, SUPERIOR)
    if (aCategory.priority !== bCategory.priority) {
      return aCategory.priority - bCategory.priority;
    }

    // 3. Ordenar por desayuno (sin desayuno primero, con desayuno después)
    if (aBreakfast !== bBreakfast) {
      return aBreakfast ? 1 : -1;
    }

    // 4. Ordenar por precio (más barato primero)
    return a.total_price - b.total_price;
  });
};

const getPrimaryVisibleRoom = (rooms: LocalHotelData['rooms']) => {
  const sortedRooms = sortHotelRooms(rooms);
  return sortedRooms[0];
};

const formatRoomAvailability = (room?: LocalHotelData['rooms'][number]) => {
  if (!room?.availability || room.availability <= 0) {
    return '❌';
  }

  if (room.availability >= 3) {
    return '✅';
  }

  return `⚠️ ${room.availability}`;
};

const formatPrimaryRoomLine = (room?: LocalHotelData['rooms'][number], language: UserLanguage = 'es') => {
  if (!room) {
    return '';
  }

  const copy = getChatResultCopy(language);
  const rawDescription = room.description || room.type || copy.standardRoom as string;
  const translatedDescription = formatRoomText(rawDescription, language);
  const breakfast = rawDescription.toLowerCase().includes('breakfast') ||
    rawDescription.toLowerCase().includes('desayuno') ? ' 🍳' : '';
  const availability = formatRoomAvailability(room);

  return `🛏️ ${translatedDescription}${breakfast} - ${room.total_price} ${room.currency} ${availability}`;
};

export const formatChainBalanceSummary = (chainBalance?: LocalHotelChainBalance, language: UserLanguage = 'es') => {
  if (!chainBalance || chainBalance.requestedChains.length <= 1) {
    return '';
  }

  const visibleQuotas = chainBalance.quotas
    .filter((quota) => quota.selectedHotels > 0)
    .map((quota) => `${quota.chain} (${quota.selectedHotels})`);

  if (visibleQuotas.length === 0) {
    return '';
  }

  return `⚖️ **${getChatResultCopy(language).chainDistribution}:** ${visibleQuotas.join(', ')}`;
};

/**
 * Hotel response copy modes — Phase 2 / sub-task C (exact-match-first flow).
 *
 * - `exact_match`: user named a specific hotel and EUROVIPS returned it.
 * - `alternatives_no_availability`: user named a specific hotel, 0 hits → city-broad fallback returned options.
 * - `hotel_not_in_destination`: user named a specific hotel; both exact-name and city-broad fallback returned 0.
 * - `generic_search`: no specific hotel requested (chain only / multi-name / city-only).
 */
export type HotelResponseMode =
  | 'exact_match'
  | 'alternatives_no_availability'
  | 'hotel_not_in_destination'
  | 'generic_search';

interface FormatHotelResponseOptions {
  /**
   * Branching copy mode. Defaults to `'generic_search'` for backward compat
   * with all existing call sites (multi-segment hotel formatter, etc.).
   */
  responseMode?: HotelResponseMode;
  /**
   * The hotel name the user requested (only meaningful for the three
   * non-generic modes). Used to render the differentiated heading.
   */
  requestedHotelName?: string;
  /**
   * Fallback city used in the heading when the user requested a specific
   * hotel. If absent, derived from the first hotel's `city` field.
   */
  requestedCity?: string;
}

export const formatHotelResponse = (
  hotels: LocalHotelData[],
  language: UserLanguage = 'es',
  options: FormatHotelResponseOptions = {}
) => {
  const copy = getChatResultCopy(language);
  const responseMode: HotelResponseMode = options.responseMode || 'generic_search';
  const requestedHotelName = (options.requestedHotelName || '').trim();
  const cityForCopy = (options.requestedCity || hotels[0]?.city || '').trim();

  // Mode: hotel_not_in_destination — empty list, dedicated copy with recovery prompt.
  if (responseMode === 'hotel_not_in_destination' && requestedHotelName) {
    return (copy.hotelNotInDestination as (hotel: string, city: string) => string)(
      requestedHotelName,
      cityForCopy || requestedHotelName,
    );
  }

  if (hotels.length === 0) {
    return copy.noHotels as string;
  }

  const displayCount = Math.min(hotels.length, 5);
  let response: string;

  if (responseMode === 'exact_match' && requestedHotelName) {
    if (hotels.length === 1) {
      response = (copy.hotelExactMatchSingle as (hotel: string) => string)(requestedHotelName);
    } else {
      const extra = hotels.length - 1;
      response = (copy.hotelExactMatchMulti as (hotel: string, extra: number, city: string) => string)(
        requestedHotelName,
        extra,
        cityForCopy,
      );
    }
  } else if (responseMode === 'alternatives_no_availability' && requestedHotelName) {
    response = (copy.hotelAlternativesNoAvailability as (hotel: string, count: number, city: string) => string)(
      requestedHotelName,
      displayCount,
      cityForCopy,
    );
  } else {
    response = (copy.hotelsAvailable as (displayCount: number, total: number) => string)(displayCount, hotels.length);
  }

  hotels.slice(0, 5).forEach((hotel, index) => {
    const minPrice = Math.min(...hotel.rooms.map((r) => r.total_price));
    const primaryRoom = getPrimaryVisibleRoom(hotel.rooms);
    const extraRooms = Math.max((hotel.rooms?.length || 0) - 1, 0);

    response += `---\n\n`;
    response += `🏨 **${hotel.name}**\n`;
    response += `📍 ${hotel.city}\n`;
    response += `💰 ${copy.from as string} ${minPrice} ${hotel.rooms[0].currency}\n`;
    response += `🌙 ${(copy.nights as (count: number) => string)(hotel.nights)}\n`;
    response += `📅 ${hotel.check_in} → ${hotel.check_out}\n`;

    if (primaryRoom) {
      response += `${formatPrimaryRoomLine(primaryRoom, language)}\n`;
    }

    if (extraRooms > 0) {
      response += `➕ ${(copy.additionalRooms as (count: number) => string)(extraRooms)}\n`;
    }

    response += '\n';
  });

  response += `\n${copy.selectHotels as string}`;
  return response;
};

export const formatChainBalanceNote = (chainBalance?: LocalHotelChainBalance, language: UserLanguage = 'es') => {
  if (!chainBalance || chainBalance.requestedChains.length <= 1) {
    return '';
  }

  const impactedChains = chainBalance.quotas.filter((quota) => quota.status !== 'fulfilled');
  if (impactedChains.length === 0) {
    return '';
  }

  const notes = impactedChains.map((quota) => {
    if (quota.status === 'missing') {
      return getChatResultCopy(language).missingChain(quota.chain);
    }

    return getChatResultCopy(language).partialChain(quota.chain, quota.selectedHotels, quota.requestedQuota);
  });

  return `ℹ️ **${getChatResultCopy(language).chainBalance}:** ${notes.join(' ')}`;
};

export const formatMultiSegmentHotelResponse = (
  segments: LocalHotelSegmentResult[],
  language: UserLanguage = 'es'
) => {
  const copy = getChatResultCopy(language);
  if (segments.length === 0) {
    return copy.noHotels as string;
  }

  let response = copy.multiSegmentHotels as string;

  segments.forEach((segment, index) => {
    response += `### ${index + 1}. ${segment.city} (${segment.checkinDate} → ${segment.checkoutDate})\n\n`;

    if (segment.error) {
      response += `❌ ${segment.error}\n\n`;
      return;
    }

    if (segment.hotels.length === 0) {
      response += copy.segmentNoHotels as string;
      return;
    }

    const hotelCount = Math.min(segment.hotels.length, 5);
    response += (copy.segmentFound as (count: number) => string)(hotelCount);
    const chainBalanceSummary = formatChainBalanceSummary(segment.chainBalance, language);
    if (chainBalanceSummary) {
      response += `${chainBalanceSummary}\n\n`;
    }
    const chainBalanceNote = formatChainBalanceNote(segment.chainBalance, language);
    if (chainBalanceNote) {
      response += `${chainBalanceNote}\n\n`;
    }
    response += formatHotelResponse(segment.hotels.slice(0, 5), language);
    response += '\n\n';
  });

  response += copy.reviewSegments as string;
  return response;
};

export const formatServiceResponse = (services: LocalServiceData[], language: UserLanguage = 'es') => {
  const copy = getResponseFormatterCopy(language);
  if (services.length === 0) {
    return copy.noServices;
  }

  let response = copy.servicesAvailable(services.length);

  services.slice(0, 5).forEach((service) => {
    response += `---\n\n`;
    response += `🚌 **${service.name}**\n`;
    response += `📍 ${service.city}\n`;
    response += `💰 **${copy.servicePrice}:** ${service.price} ${service.currency}\n`;
    response += `⏰ **${copy.serviceDuration}:** ${service.duration}\n\n`;
  });

  response += copy.selectServices;
  return response;
};

export const formatActivityResponse = (
  activities: Array<{
    name: string;
    city: string;
    price: { amount: number; currency: string; priceFrom?: boolean };
    duration?: string;
    description?: string;
    categories?: string[];
    cancellationPolicy?: string;
  }>,
  language: UserLanguage = 'es',
) => {
  const copy = getResponseFormatterCopy(language);
  if (activities.length === 0) {
    return copy.noActivities;
  }

  let response = copy.activitiesAvailable(activities.length);

  activities.slice(0, 10).forEach((activity, index) => {
    response += `---\n\n`;
    response += `🎭 **${index + 1}. ${activity.name}**\n`;
    response += `📍 ${activity.city}\n`;
    response += `💰 ${activity.price.priceFrom ? copy.activityPriceFrom : ''}${activity.price.amount} ${activity.price.currency}\n`;
    if (activity.duration) {
      response += `⏱️ ${activity.duration}\n`;
    }
    if (activity.categories && activity.categories.length > 0) {
      response += `🏷️ ${activity.categories.join(', ')}\n`;
    }
    if (activity.cancellationPolicy) {
      response += `📋 ${activity.cancellationPolicy}\n`;
    }
    response += '\n';
  });

  return response;
};

export const formatTransferResponse = (
  transfers: Array<{
    type: string;
    direction: string;
    vehicle: string;
    maxPassengers: number;
    price: { amount: number; currency: string };
    pickup: { location: string; time?: string };
    dropoff: { location: string };
    cancellationPolicy?: string;
  }>,
  language: UserLanguage = 'es',
) => {
  const copy = getResponseFormatterCopy(language);
  if (transfers.length === 0) {
    return copy.noTransfers;
  }

  let response = copy.transfersAvailable(transfers.length);

  transfers.slice(0, 10).forEach((transfer, index) => {
    response += `---\n\n`;
    response += `🚐 **${copy.transferOption(index + 1)}** - ${transfer.type}\n`;
    response += `🚗 ${transfer.vehicle} (${copy.transferMaxPax(transfer.maxPassengers)})\n`;
    response += `📍 ${transfer.pickup.location} → ${transfer.dropoff.location}\n`;
    response += `💰 ${transfer.price.amount} ${transfer.price.currency}\n`;
    response += `🔄 ${transfer.direction.replace('_', ' ')}\n`;
    if (transfer.cancellationPolicy) {
      response += `📋 ${transfer.cancellationPolicy}\n`;
    }
    response += '\n';
  });

  return response;
};

export const formatCombinedResponse = (combinedData: LocalCombinedTravelResults, language: UserLanguage = 'es') => {
  const copy = getChatResultCopy(language);
  const bestFlight = combinedData.flights[0];
  const bestHotel = combinedData.hotels[0];
  const parts: string[] = [copy.combinedBase as string];

  if (bestFlight) {
    const firstLeg = bestFlight.legs?.[0];
    const firstOption = firstLeg?.options?.[0];
    const firstSegment = firstOption?.segments?.[0];
    const lastSegment = firstOption?.segments?.[firstOption.segments.length - 1];
    const route = firstSegment && lastSegment
      ? `${firstSegment.departure?.airportCode || '?'} → ${lastSegment.arrival?.airportCode || '?'}`
      : copy.flightFallback as string;
    const flightReason = bestFlight.stops?.count === 0 ? copy.flightComfort as string : copy.flightBalanced as string;
    const airline = bestFlight.airline?.name || (language === 'en' ? 'the main airline' : language === 'pt' ? 'a companhia principal' : 'la aerolínea principal');
    parts.push((copy.recommendedFlight as (route: string, airline: string, amount: number, currency: string, reason: string) => string)(route, airline, bestFlight.price?.amount || 0, bestFlight.price?.currency || 'USD', flightReason));
  }

  if (bestHotel) {
    const room = bestHotel.rooms?.[0];
    const nightly = room?.price_per_night || (room?.total_price && bestHotel.nights > 0 ? Math.round(room.total_price / bestHotel.nights) : null);
    const hotelReason = bestHotel.category ? `${bestHotel.category}★ ${copy.wellLocated as string}` : copy.wellLocated as string;
    parts.push((copy.recommendedHotel as (name: string, nightly: number | null, currency: string, reason: string) => string)(bestHotel.name, nightly, room?.currency || 'USD', hotelReason));
  }

  parts.push(copy.compareNext as string);
  return parts.join('\n');
};

// =====================================================================
// ITINERARY FORMATTER - Formats AI-generated travel itineraries
// =====================================================================

interface ItineraryActivity {
  time: string;
  activity: string;
  tip?: string;
}

interface ItineraryRestaurant {
  name: string;
  type: string;
  priceRange: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  morning: ItineraryActivity[];
  afternoon: ItineraryActivity[];
  evening: ItineraryActivity[];
  restaurants: ItineraryRestaurant[];
  travelTip: string;
}

interface ItineraryData {
  destinations: string[];
  days: number;
  title: string;
  introduction: string;
  itinerary: ItineraryDay[];
  generalTips: string[];
}

export const formatItineraryResponse = (data: ItineraryData, language: UserLanguage = 'es'): string => {
  const copy = getResponseFormatterCopy(language);
  const travelerCopy = getTravelerCopy(language);
  if (!data || !data.itinerary || data.itinerary.length === 0) {
    return copy.itineraryFallback;
  }

  let response = `🗺️ **${data.title}**\n\n`;
  response += `📍 **${copy.itineraryDestinations}:** ${data.destinations.join(', ')}\n`;
  response += `📅 **${copy.itineraryDuration}:** ${travelerCopy.day(data.days)}\n\n`;

  if (data.introduction) {
    response += `${data.introduction}\n\n`;
  }

  response += '---\n\n';

  // Format each day
  data.itinerary.forEach((day) => {
    response += copy.itineraryDayLabel(day.day, day.title);

    // Morning activities
    if (day.morning && day.morning.length > 0) {
      response += `${copy.itineraryMorning}\n`;
      day.morning.forEach((activity) => {
        response += `• **${activity.time}** - ${activity.activity}`;
        if (activity.tip) {
          response += `\n  💡 *${activity.tip}*`;
        }
        response += '\n';
      });
      response += '\n';
    }

    // Afternoon activities
    if (day.afternoon && day.afternoon.length > 0) {
      response += `${copy.itineraryAfternoon}\n`;
      day.afternoon.forEach((activity) => {
        response += `• **${activity.time}** - ${activity.activity}`;
        if (activity.tip) {
          response += `\n  💡 *${activity.tip}*`;
        }
        response += '\n';
      });
      response += '\n';
    }

    // Evening activities
    if (day.evening && day.evening.length > 0) {
      response += `${copy.itineraryEvening}\n`;
      day.evening.forEach((activity) => {
        response += `• **${activity.time}** - ${activity.activity}`;
        if (activity.tip) {
          response += `\n  💡 *${activity.tip}*`;
        }
        response += '\n';
      });
      response += '\n';
    }

    // Restaurants
    if (day.restaurants && day.restaurants.length > 0) {
      response += `${copy.itineraryRestaurants}\n`;
      day.restaurants.forEach((restaurant) => {
        response += `• **${restaurant.name}** - ${restaurant.type} (${restaurant.priceRange})\n`;
      });
      response += '\n';
    }

    // Daily travel tip
    if (day.travelTip) {
      response += `💡 **${copy.itineraryDailyTip}:** ${day.travelTip}\n`;
    }

    response += '\n---\n\n';
  });

  // General tips
  if (data.generalTips && data.generalTips.length > 0) {
    response += copy.itineraryGeneralTips;
    data.generalTips.forEach((tip, index) => {
      response += `${index + 1}. ${tip}\n`;
    });
    response += '\n';
  }

  response += '---\n\n';
  response += copy.itineraryClosingPrompt;

  return response;
};
