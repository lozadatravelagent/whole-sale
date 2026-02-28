import type {
  FlightData,
  LocalHotelData,
  LocalHotelSegmentResult,
  LocalPackageData,
  LocalServiceData,
  LocalCombinedTravelResults
} from '../types/chat';
import { generateFlightItinerary } from './flightTransformer';
import { formatDuration } from '../utils/flightHelpers';
import { translateRoomDescription, translateRoomTypeTitle, translateFlightInfo, translateBaggage } from '../utils/translations';

// Response formatters - using the main FlightData interface
export const formatFlightResponse = (flights: FlightData[]) => {
  if (flights.length === 0) {
    return '✈️ **Búsqueda de Vuelos**\n\nNo encontré vuelos disponibles para esas fechas y destino. Intenta con fechas alternativas.';
  }

  const displayCount = Math.min(flights.length, 5);
  let response = `✈️ **${displayCount} Vuelos Disponibles** ${flights.length > 5 ? `(los ${displayCount} más económicos de ${flights.length})` : '(ordenados por precio)'}\n\n`;

  flights.slice(0, 5).forEach((flight, index) => {
    response += `---\n\n`;
    response += `✈️ **Opción ${index + 1}** - ${flight.airline.name} (${flight.airline.code})\n`;

    // Información de precio detallada
    response += `💰 **Precio Total:** ${flight.price.amount} ${flight.price.currency}\n`;
    if (flight.price.breakdown) {
      response += `   • Tarifa Base: ${flight.price.breakdown.fareAmount} ${flight.price.currency}\n`;
      response += `   • Tasas: ${flight.price.breakdown.taxAmount} ${flight.price.currency}\n`;
      if (flight.price.breakdown.serviceAmount > 0) {
        response += `   • Servicios: ${flight.price.breakdown.serviceAmount} ${flight.price.currency}\n`;
      }
      if (flight.price.breakdown.commissionAmount > 0) {
        response += `   • Comisión: ${flight.price.breakdown.commissionAmount} ${flight.price.currency}\n`;
      }
    }

    // Información de fechas y horarios
    response += `🛫 **Salida:** ${flight.departure_date} ${flight.departure_time || ''}\n`;
    response += `🛬 **Llegada:** ${flight.arrival_date} ${flight.arrival_time || ''}\n`;
    if (flight.return_date && flight.trip_type !== 'multi_city') {
      response += `🔄 **Regreso:** ${flight.return_date}\n`;
    } else if (flight.trip_type === 'multi_city') {
      response += `🗺️ **Tipo:** Multi-city (${flight.legs?.length || 0} tramos)\n`;
    }

    // Duración y escalas
    response += `⏱️ **Duración:** ${flight.duration?.formatted || 'N/A'}\n`;
    response += `🛑 **Tipo:** ${flight.stops?.direct ? 'Vuelo directo' : `Con ${flight.stops?.count || 0} conexión(es)`}\n`;

    // Información de equipaje mejorada
    const baggageDetails = flight.baggage?.details ? translateBaggage(flight.baggage.details) : 'N/A';
    response += `🧳 **Equipaje despachado:** ${baggageDetails}\n`;

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
      response += `🎒 **Equipaje de mano:** ✅ ${carryOnQuantity} pieza(s) incluida(s)`;
      if (flight.baggage?.carryOnWeight) {
        response += ` (${flight.baggage.carryOnWeight})`;
      }
      response += '\n';
    } else {
      response += `🎒 **Equipaje de mano:** ❌ No incluido\n`;
    }

    // Clase de cabina
    const cabinClass = flight.cabin?.brandName || flight.cabin?.class || 'Economy';
    const translatedCabinClass = translateFlightInfo(cabinClass);
    response += `💺 **Clase:** ${translatedCabinClass}\n`;

    // Información de reserva
    if (flight.booking?.lastTicketingDate) {
      const ticketingDate = new Date(flight.booking.lastTicketingDate).toLocaleDateString('es-ES');
      response += `📅 **Válido hasta:** ${ticketingDate}\n`;
    }

    // Itinerario detallado visual
    const itinerary = generateFlightItinerary(flight);
    response += itinerary;

    // FareID para referencia
    response += `\n🆔 **ID de Tarifa:** ${flight.id}\n\n`;
  });

  response += '\n📋 Selecciona las opciones que prefieras para generar tu cotización.';
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

  return rooms.sort((a, b) => {
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

// Función para agrupar habitaciones por tipo
const groupRoomsByType = (rooms: LocalHotelData['rooms']) => {
  const groups: { [key: string]: LocalHotelData['rooms'] } = {};

  rooms.forEach(room => {
    const desc = (room.description || '').toLowerCase();
    const type = (room.type || '').toLowerCase();
    let groupKey = 'OTHER';

    // Check both description and type field, support English and Spanish
    if (desc.includes('single') || desc.includes('sgl') || desc.includes('individual') || type.includes('sgl')) {
      groupKey = 'SGL';
    } else if ((desc.includes('double') || desc.includes('doble')) && (desc.includes('single use') || desc.includes('uso individual'))) {
      groupKey = 'DUS';
    } else if (desc.includes('double') || desc.includes('doble') || desc.includes('dbl') || type.includes('dbl') || type.includes('dwl')) {
      groupKey = 'DBL';
    } else if (desc.includes('triple') || type.includes('tpl')) {
      groupKey = 'TPL';
    } else if (desc.includes('quad') || desc.includes('cuádruple') || desc.includes('cuadruple') || desc.includes('family') || desc.includes('familiar') || type.includes('qua')) {
      groupKey = 'QUA';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(room);
  });

  return groups;
};

export const formatHotelResponse = (
  hotels: LocalHotelData[]
) => {
  if (hotels.length === 0) {
    return '🏨 **Búsqueda de Hoteles**\n\nNo encontré hoteles disponibles. Verifica la ciudad y fechas.';
  }

  const displayCount = Math.min(hotels.length, 5);
  let response = `🏨 **${displayCount} Hoteles Disponibles** ${hotels.length > 5 ? `(los ${displayCount} más económicos de ${hotels.length})` : '(ordenados por precio)'}\n\n`;

  hotels.slice(0, 5).forEach((hotel, index) => {
    const minPrice = Math.min(...hotel.rooms.map((r) => r.total_price));

    // ✅ Hotels are already filtered by handleHotelSearch, no need to filter again
    // Just sort and group the already-filtered rooms
    const sortedRooms = sortHotelRooms(hotel.rooms);
    const roomGroups = groupRoomsByType(sortedRooms);

    response += `---\n\n`;
    response += `🏨 **${hotel.name}**\n`;
    response += `📍 ${hotel.city}\n`;
    response += `💰 Desde ${minPrice} ${hotel.rooms[0].currency}\n`;
    response += `🌙 ${hotel.nights} noches\n`;
    response += `📅 ${hotel.check_in} → ${hotel.check_out}\n\n`;

    // Mostrar habitaciones agrupadas por tipo (máximo 3 por tipo)
    Object.entries(roomGroups).forEach(([type, rooms]) => {
      const typeName = `🛏️ ${translateRoomTypeTitle(type)}`;

      response += `**${typeName}:**\n`;

      // Mostrar máximo 3 habitaciones por tipo, ordenadas por precio
      rooms.slice(0, 3).forEach((room, roomIndex) => {
        const translatedDescription = translateRoomDescription(room.description || 'Habitación estándar');
        const breakfast = (room.description || '').toLowerCase().includes('breakfast') ||
          (room.description || '').toLowerCase().includes('desayuno') ? ' 🍳' : '';
        const availability = room.availability && room.availability > 0 ?
          (room.availability >= 3 ? '✅' : `⚠️ ${room.availability}`) : '❌';

        response += `   • ${translatedDescription}${breakfast} - ${room.total_price} ${room.currency} ${availability}\n`;
      });

      if (rooms.length > 3) {
        response += `   • ... y ${rooms.length - 3} opciones más\n`;
      }
      response += `\n`;
    });
  });

  response += '\n📋 Selecciona los hoteles que prefieras para tu cotización.';
  return response;
};

export const formatMultiSegmentHotelResponse = (
  segments: LocalHotelSegmentResult[]
) => {
  if (segments.length === 0) {
    return '🏨 **Búsqueda de Hoteles**\n\nNo encontré hoteles disponibles. Verifica la ciudad y fechas.';
  }

  let response = '🏨 **Búsqueda de Hoteles Multi-Destino**\n\n';

  segments.forEach((segment, index) => {
    response += `### ${index + 1}. ${segment.city} (${segment.checkinDate} → ${segment.checkoutDate})\n\n`;

    if (segment.error) {
      response += `❌ ${segment.error}\n\n`;
      return;
    }

    if (segment.hotels.length === 0) {
      response += 'No encontré hoteles disponibles para este tramo.\n\n';
      return;
    }

    const hotelCount = Math.min(segment.hotels.length, 5);
    response += `Encontré ${hotelCount} hotel${hotelCount !== 1 ? 'es' : ''} para este tramo.\n\n`;
    response += formatHotelResponse(segment.hotels.slice(0, 5));
    response += '\n\n';
  });

  response += '📋 Revisa cada tramo por separado para armar la cotización completa.';
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

export const formatCombinedResponse = (combinedData: LocalCombinedTravelResults) => {
  let response = '🌟 **Búsqueda Combinada Completada**\n\n';

  if (combinedData.flights.length > 0) {
    const flightCount = Math.min(combinedData.flights.length, 5);
    response += `✈️ **${flightCount} vuelos disponibles** (ordenados por precio más bajo)\n`;
  }

  if (combinedData.hotels.length > 0) {
    const hotelCount = Math.min(combinedData.hotels.length, 5);
    response += `🏨 **${hotelCount} hoteles disponibles** (ordenados por precio más bajo)\n`;
  }

  response += '\n📋 Usa los selectores interactivos para crear tu cotización personalizada.';
  return response;
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
