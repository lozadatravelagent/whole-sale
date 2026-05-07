import type {
  FlightData,
  LocalHotelData,
  LocalHotelChainBalance,
  LocalHotelSegmentResult,
  LocalCombinedTravelResults,
} from '@/types/external';
import type { LocalPackageData, LocalServiceData } from '@/types/external';
import { generateFlightItinerary } from './flightTransformer';
import { formatDuration } from '../utils/flightHelpers';
import { translateRoomDescription, translateRoomTypeTitle, translateFlightInfo, translateBaggage } from '../utils/translations';
import type { UserLanguage } from '@/services/aiMessageParser';

const LOCALE_BY_LANGUAGE: Record<UserLanguage, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR',
};

const COPY = {
  es: {
    noFlights: '✈️ **Búsqueda de Vuelos**\n\nNo encontré vuelos disponibles para esas fechas y destino. Intenta con fechas alternativas.',
    flightsAvailable: (displayCount: number, total: number) => `✈️ **${displayCount} Vuelos Disponibles** ${total > 5 ? `(los ${displayCount} más económicos de ${total})` : '(ordenados por precio)'}\n\n`,
    option: 'Opción',
    totalPrice: 'Precio Total',
    baseFare: 'Tarifa Base',
    taxes: 'Tasas',
    services: 'Servicios',
    commission: 'Comisión',
    departure: 'Salida',
    arrival: 'Llegada',
    return: 'Regreso',
    type: 'Tipo',
    duration: 'Duración',
    directFlight: 'Vuelo directo',
    withConnections: (count: number) => `Con ${count} conexión(es)`,
    checkedBaggage: 'Equipaje despachado',
    carryOn: 'Equipaje de mano',
    included: 'incluida(s)',
    notIncluded: 'No incluido',
    cabinClass: 'Clase',
    validUntil: 'Válido hasta',
    fareId: 'ID de Tarifa',
    selectFlights: '📋 Selecciona las opciones que prefieras para generar tu cotización.',
    noHotels: '🏨 **Búsqueda de Hoteles**\n\nNo encontré hoteles disponibles. Verifica la ciudad y fechas.',
    hotelsAvailable: (displayCount: number, total: number) => `🏨 **${displayCount} Hoteles Disponibles** ${total > 5 ? `(los ${displayCount} más económicos de ${total})` : '(ordenados por precio)'}\n\n`,
    standardRoom: 'Habitación estándar',
    from: 'Desde',
    nights: (count: number) => `${count} noches`,
    additionalRooms: (count: number) => `${count} habitaci${count === 1 ? 'ón adicional' : 'ones adicionales'} disponibles`,
    chainDistribution: 'Distribución por cadena',
    chainBalance: 'Balance por cadena',
    missingChain: (chain: string) => `No encontré opciones válidas de ${chain} para este tramo.`,
    partialChain: (chain: string, selected: number, requested: number) => `${chain} solo cubrió ${selected} de ${requested} lugar${requested !== 1 ? 'es' : ''} previsto${requested !== 1 ? 's' : ''}.`,
    multiSegmentHotels: '🏨 **Búsqueda de Hoteles Multi-Destino**\n\n',
    segmentNoHotels: 'No encontré hoteles disponibles para este tramo.\n\n',
    segmentFound: (count: number) => `Encontré ${count} hotel${count !== 1 ? 'es' : ''} para este tramo.\n\n`,
    reviewSegments: '📋 Revisa cada tramo por separado para armar la cotización completa.',
    selectHotels: '📋 Selecciona los hoteles que prefieras para tu cotización.',
    combinedBase: 'Ya te dejé una base bastante concreta para este viaje:',
    flightFallback: 'tramo aéreo listo',
    flightComfort: 'por comodidad',
    flightBalanced: 'por equilibrio entre precio y horario',
    recommendedFlight: (route: string, airline: string, amount: number, currency: string, reason: string) => `- vuelo recomendado: ${route} con ${airline} desde ${amount} ${currency} (${reason})`,
    wellLocated: 'bien ubicado',
    recommendedHotel: (name: string, nightly: number | null, currency: string, reason: string) => `- hotel recomendado: ${name} ${nightly ? `desde ${nightly} ${currency}/noche` : 'con tarifa para revisar'} (${reason})`,
    compareNext: 'Si querés, ahora comparo una opción más económica contra una más equilibrada y te digo cuál conviene más.',
  },
  en: {
    noFlights: '✈️ **Flight Search**\n\nI could not find available flights for those dates and destination. Try alternative dates.',
    flightsAvailable: (displayCount: number, total: number) => `✈️ **${displayCount} Available Flights** ${total > 5 ? `(the ${displayCount} cheapest of ${total})` : '(sorted by price)'}\n\n`,
    option: 'Option',
    totalPrice: 'Total Price',
    baseFare: 'Base Fare',
    taxes: 'Taxes',
    services: 'Services',
    commission: 'Commission',
    departure: 'Departure',
    arrival: 'Arrival',
    return: 'Return',
    type: 'Type',
    duration: 'Duration',
    directFlight: 'Direct flight',
    withConnections: (count: number) => `With ${count} connection(s)`,
    checkedBaggage: 'Checked baggage',
    carryOn: 'Carry-on baggage',
    included: 'included',
    notIncluded: 'Not included',
    cabinClass: 'Cabin class',
    validUntil: 'Valid until',
    fareId: 'Fare ID',
    selectFlights: '📋 Select the options you prefer to generate your quote.',
    noHotels: '🏨 **Hotel Search**\n\nI could not find available hotels. Check the city and dates.',
    hotelsAvailable: (displayCount: number, total: number) => `🏨 **${displayCount} Available Hotels** ${total > 5 ? `(the ${displayCount} cheapest of ${total})` : '(sorted by price)'}\n\n`,
    standardRoom: 'Standard room',
    from: 'From',
    nights: (count: number) => `${count} night${count === 1 ? '' : 's'}`,
    additionalRooms: (count: number) => `${count} additional room${count === 1 ? '' : 's'} available`,
    chainDistribution: 'Chain distribution',
    chainBalance: 'Chain balance',
    missingChain: (chain: string) => `I could not find valid ${chain} options for this segment.`,
    partialChain: (chain: string, selected: number, requested: number) => `${chain} covered only ${selected} of ${requested} planned slot${requested === 1 ? '' : 's'}.`,
    multiSegmentHotels: '🏨 **Multi-Destination Hotel Search**\n\n',
    segmentNoHotels: 'I could not find available hotels for this segment.\n\n',
    segmentFound: (count: number) => `I found ${count} hotel${count === 1 ? '' : 's'} for this segment.\n\n`,
    reviewSegments: '📋 Review each segment separately to build the complete quote.',
    selectHotels: '📋 Select the hotels you prefer for your quote.',
    combinedBase: 'I put together a concrete starting point for this trip:',
    flightFallback: 'flight segment ready',
    flightComfort: 'for convenience',
    flightBalanced: 'for a balance between price and schedule',
    recommendedFlight: (route: string, airline: string, amount: number, currency: string, reason: string) => `- recommended flight: ${route} with ${airline} from ${amount} ${currency} (${reason})`,
    wellLocated: 'well located',
    recommendedHotel: (name: string, nightly: number | null, currency: string, reason: string) => `- recommended hotel: ${name} ${nightly ? `from ${nightly} ${currency}/night` : 'with a rate to review'} (${reason})`,
    compareNext: 'I can now compare a cheaper option against a more balanced one and tell you which is better.',
  },
  pt: {
    noFlights: '✈️ **Busca de Voos**\n\nNão encontrei voos disponíveis para essas datas e destino. Tente datas alternativas.',
    flightsAvailable: (displayCount: number, total: number) => `✈️ **${displayCount} Voos Disponíveis** ${total > 5 ? `(os ${displayCount} mais econômicos de ${total})` : '(ordenados por preço)'}\n\n`,
    option: 'Opção',
    totalPrice: 'Preço Total',
    baseFare: 'Tarifa Base',
    taxes: 'Taxas',
    services: 'Serviços',
    commission: 'Comissão',
    departure: 'Saída',
    arrival: 'Chegada',
    return: 'Volta',
    type: 'Tipo',
    duration: 'Duração',
    directFlight: 'Voo direto',
    withConnections: (count: number) => `Com ${count} conexão(ões)`,
    checkedBaggage: 'Bagagem despachada',
    carryOn: 'Bagagem de mão',
    included: 'incluída(s)',
    notIncluded: 'Não incluído',
    cabinClass: 'Classe',
    validUntil: 'Válido até',
    fareId: 'ID da Tarifa',
    selectFlights: '📋 Selecione as opções que prefere para gerar sua cotação.',
    noHotels: '🏨 **Busca de Hotéis**\n\nNão encontrei hotéis disponíveis. Verifique a cidade e as datas.',
    hotelsAvailable: (displayCount: number, total: number) => `🏨 **${displayCount} Hotéis Disponíveis** ${total > 5 ? `(os ${displayCount} mais econômicos de ${total})` : '(ordenados por preço)'}\n\n`,
    standardRoom: 'Quarto padrão',
    from: 'Desde',
    nights: (count: number) => `${count} noite${count === 1 ? '' : 's'}`,
    additionalRooms: (count: number) => `${count} quarto${count === 1 ? ' adicional disponível' : 's adicionais disponíveis'}`,
    chainDistribution: 'Distribuição por rede',
    chainBalance: 'Balanço por rede',
    missingChain: (chain: string) => `Não encontrei opções válidas de ${chain} para este trecho.`,
    partialChain: (chain: string, selected: number, requested: number) => `${chain} cobriu apenas ${selected} de ${requested} lugar${requested !== 1 ? 'es' : ''} previsto${requested !== 1 ? 's' : ''}.`,
    multiSegmentHotels: '🏨 **Busca de Hotéis Multi-Destino**\n\n',
    segmentNoHotels: 'Não encontrei hotéis disponíveis para este trecho.\n\n',
    segmentFound: (count: number) => `Encontrei ${count} hotel${count !== 1 ? 'is' : ''} para este trecho.\n\n`,
    reviewSegments: '📋 Revise cada trecho separadamente para montar a cotação completa.',
    selectHotels: '📋 Selecione os hotéis que prefere para sua cotação.',
    combinedBase: 'Deixei uma base bem concreta para esta viagem:',
    flightFallback: 'trecho aéreo pronto',
    flightComfort: 'por comodidade',
    flightBalanced: 'por equilíbrio entre preço e horário',
    recommendedFlight: (route: string, airline: string, amount: number, currency: string, reason: string) => `- voo recomendado: ${route} com ${airline} desde ${amount} ${currency} (${reason})`,
    wellLocated: 'bem localizado',
    recommendedHotel: (name: string, nightly: number | null, currency: string, reason: string) => `- hotel recomendado: ${name} ${nightly ? `desde ${nightly} ${currency}/noite` : 'com tarifa para revisar'} (${reason})`,
    compareNext: 'Agora posso comparar uma opção mais econômica com uma mais equilibrada e dizer qual convém mais.',
  },
} satisfies Record<UserLanguage, Record<string, unknown>>;

const getCopy = (language: UserLanguage = 'es') => COPY[language] || COPY.es;

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
        return `✅ ${quantity}${baggageType.includes('PC') ? ` ${unit}` : unit} ${getCopy(language).included}`;
      }
      return `❌ ${getCopy(language).notIncluded}`;
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
  const copy = getCopy(language);
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

  const copy = getCopy(language);
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

  return `⚖️ **${getCopy(language).chainDistribution as string}:** ${visibleQuotas.join(', ')}`;
};

export const formatHotelResponse = (
  hotels: LocalHotelData[],
  language: UserLanguage = 'es'
) => {
  const copy = getCopy(language);
  if (hotels.length === 0) {
    return copy.noHotels as string;
  }

  const displayCount = Math.min(hotels.length, 5);
  let response = (copy.hotelsAvailable as (displayCount: number, total: number) => string)(displayCount, hotels.length);

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
      return (getCopy(language).missingChain as (chain: string) => string)(quota.chain);
    }

    return (getCopy(language).partialChain as (chain: string, selected: number, requested: number) => string)(quota.chain, quota.selectedHotels, quota.requestedQuota);
  });

  return `ℹ️ **${getCopy(language).chainBalance as string}:** ${notes.join(' ')}`;
};

export const formatMultiSegmentHotelResponse = (
  segments: LocalHotelSegmentResult[],
  language: UserLanguage = 'es'
) => {
  const copy = getCopy(language);
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

export const formatPackageResponse = (packages: LocalPackageData[]) => {
  if (packages.length === 0) {
    return '🎒 **Búsqueda de Paquetes**\n\nNo encontré paquetes disponibles. Intenta con otro destino o fechas.';
  }

  let response = `🎒 **${packages.length} Paquetes Disponibles**\n\n`;

  packages.slice(0, 5).forEach((pkg) => {
    response += `---\n\n`;
    response += `🎒 **${pkg.name}**\n`;
    response += `📍 ${pkg.destination}\n`;
    response += `💰 **Precio:** ${pkg.price} ${pkg.currency}\n`;
    response += `📅 **Duración:** ${pkg.duration} días\n\n`;
  });

  response += '\n📋 Selecciona los paquetes que prefieras para tu cotización.';
  return response;
};

export const formatServiceResponse = (services: LocalServiceData[]) => {
  if (services.length === 0) {
    return '🚌 **Búsqueda de Servicios**\n\nNo encontré servicios disponibles. Verifica la ciudad y fechas.';
  }

  let response = `🚌 **${services.length} Servicios Disponibles**\n\n`;

  services.slice(0, 5).forEach((service) => {
    response += `---\n\n`;
    response += `🚌 **${service.name}**\n`;
    response += `📍 ${service.city}\n`;
    response += `💰 **Precio:** ${service.price} ${service.currency}\n`;
    response += `⏰ **Duración:** ${service.duration}\n\n`;
  });

  response += '\n📋 Selecciona los servicios que prefieras para tu cotización.';
  return response;
};

export const formatActivityResponse = (activities: Array<{
  name: string;
  city: string;
  price: { amount: number; currency: string; priceFrom?: boolean };
  duration?: string;
  description?: string;
  categories?: string[];
  cancellationPolicy?: string;
}>) => {
  if (activities.length === 0) {
    return '🎭 **Actividades**\n\nNo encontré actividades disponibles para ese destino y fechas.';
  }

  let response = `🎭 **${activities.length} Actividades Disponibles**\n\n`;

  activities.slice(0, 10).forEach((activity, index) => {
    response += `---\n\n`;
    response += `🎭 **${index + 1}. ${activity.name}**\n`;
    response += `📍 ${activity.city}\n`;
    response += `💰 ${activity.price.priceFrom ? 'Desde ' : ''}${activity.price.amount} ${activity.price.currency}\n`;
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

export const formatTransferResponse = (transfers: Array<{
  type: string;
  direction: string;
  vehicle: string;
  maxPassengers: number;
  price: { amount: number; currency: string };
  pickup: { location: string; time?: string };
  dropoff: { location: string };
  cancellationPolicy?: string;
}>) => {
  if (transfers.length === 0) {
    return '🚐 **Traslados**\n\nNo encontré traslados disponibles para esa ruta.';
  }

  let response = `🚐 **${transfers.length} Traslados Disponibles**\n\n`;

  transfers.slice(0, 10).forEach((transfer, index) => {
    response += `---\n\n`;
    response += `🚐 **Opción ${index + 1}** - ${transfer.type}\n`;
    response += `🚗 ${transfer.vehicle} (max ${transfer.maxPassengers} pax)\n`;
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
  const copy = getCopy(language);
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

export const formatItineraryResponse = (data: ItineraryData): string => {
  if (!data || !data.itinerary || data.itinerary.length === 0) {
    return '🗺️ No se pudo generar el itinerario. Por favor, intenta nuevamente.';
  }

  let response = `🗺️ **${data.title}**\n\n`;
  response += `📍 **Destinos:** ${data.destinations.join(', ')}\n`;
  response += `📅 **Duración:** ${data.days} días\n\n`;

  if (data.introduction) {
    response += `${data.introduction}\n\n`;
  }

  response += '---\n\n';

  // Format each day
  data.itinerary.forEach((day) => {
    response += `## 📅 **Día ${day.day}: ${day.title}**\n\n`;

    // Morning activities
    if (day.morning && day.morning.length > 0) {
      response += '☀️ **Mañana:**\n';
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
      response += '🌤️ **Tarde:**\n';
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
      response += '🌙 **Noche:**\n';
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
      response += '🍽️ **Restaurantes recomendados:**\n';
      day.restaurants.forEach((restaurant) => {
        response += `• **${restaurant.name}** - ${restaurant.type} (${restaurant.priceRange})\n`;
      });
      response += '\n';
    }

    // Daily travel tip
    if (day.travelTip) {
      response += `💡 **Tip del día:** ${day.travelTip}\n`;
    }

    response += '\n---\n\n';
  });

  // General tips
  if (data.generalTips && data.generalTips.length > 0) {
    response += '## 📝 **Tips Generales**\n\n';
    data.generalTips.forEach((tip, index) => {
      response += `${index + 1}. ${tip}\n`;
    });
    response += '\n';
  }

  response += '---\n\n';
  response += '✨ ¿Te gustaría que busque vuelos u hoteles para este viaje? Solo dímelo y te ayudo a cotizar.';

  return response;
};
