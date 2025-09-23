import type { FlightData, LocalHotelData, LocalPackageData, LocalServiceData, LocalCombinedTravelResults } from '../types/chat';
import { generateFlightItinerary } from './flightTransformer';
import { formatDuration } from '../utils/flightHelpers';

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
    if (flight.return_date) {
      response += `🔄 **Regreso:** ${flight.return_date}\n`;
    }

    // Duración y escalas
    response += `⏱️ **Duración:** ${flight.duration?.formatted || 'N/A'}\n`;
    response += `🛑 **Tipo:** ${flight.stops?.direct ? 'Vuelo directo' : `Con ${flight.stops?.count || 0} conexión(es)`}\n`;

    // Información de equipaje
    response += `🧳 **Equipaje:** ${flight.baggage?.included ? 'Incluido' : 'No incluido'} - ${flight.baggage?.details || 'N/A'}\n`;
    if (flight.baggage?.carryOnQuantity) {
      response += `   • Equipaje de mano: ${flight.baggage.carryOnQuantity} pieza(s)\n`;
    }

    // Clase de cabina
    response += `💺 **Clase:** ${flight.cabin?.brandName || flight.cabin?.class || 'Economy'}\n`;

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

export const formatHotelResponse = (hotels: LocalHotelData[]) => {
  if (hotels.length === 0) {
    return '🏨 **Búsqueda de Hoteles**\n\nNo encontré hoteles disponibles. Verifica la ciudad y fechas.';
  }

  const displayCount = Math.min(hotels.length, 5);
  let response = `🏨 **${displayCount} Hoteles Disponibles** ${hotels.length > 5 ? `(los ${displayCount} más económicos de ${hotels.length})` : '(ordenados por precio)'}\n\n`;

  hotels.slice(0, 5).forEach((hotel, index) => {
    const minPrice = Math.min(...hotel.rooms.map((r) => r.total_price));
    response += `---\n\n`;
    response += `🏨 **${hotel.name}**\n`;
    response += `📍 ${hotel.city}\n`;
    response += `💰 Desde ${minPrice} ${hotel.rooms[0].currency}\n`;
    response += `🌙 ${hotel.nights} noches\n\n`;
  });

  response += '\n📋 Selecciona los hoteles que prefieras para tu cotización.';
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