// Price calculation service for travel quotes
// Centralizes all price calculation logic with intelligent room selection

import type { FlightData, HotelData, HotelDataWithSelectedRoom, HotelRoom } from '@/types';
import { parseCurrency } from '../utils/currencyHelpers';

// ============================================================================
// TYPES
// ============================================================================

export interface RoomSelection {
  room: HotelRoom;
  source: 'selected' | 'cheapest' | 'fallback';
}

export interface HotelPriceResult {
  hotelId: string;
  hotelName: string;
  total: number;
  currency: string;
  room: HotelRoom;
  source: 'selected' | 'cheapest' | 'fallback';
  nights: number;
  pricePerNight: number;
}

export interface FlightPriceResult {
  flightId: string;
  airline: string;
  total: number;
  currency: string;
}

export interface TotalPriceBreakdown {
  hotels: HotelPriceResult[];
  flights: FlightPriceResult[];
  hotelSubtotal: number;
  flightSubtotal: number;
  grandTotal: number;
  currency: string;
  warnings: string[];
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Extrae la habitación correcta para usar en cálculos de precio
 *
 * Prioridad:
 * 1. selectedRoom del hotel (si es HotelDataWithSelectedRoom)
 * 2. Habitación por selectedRoomId (si se proporciona y existe)
 * 3. Habitación más barata (fallback inteligente)
 * 4. Primera habitación (fallback final)
 *
 * @param hotel - Datos del hotel
 * @param selectedRoomId - ID opcional de habitación seleccionada
 * @returns Objeto con habitación y fuente de selección
 * @throws Error si el hotel no tiene habitaciones
 */
export function extractRoomForCalculation(
  hotel: HotelData | HotelDataWithSelectedRoom,
  selectedRoomId?: string
): RoomSelection {
  // Validar que el hotel tenga habitaciones
  if (!hotel.rooms || hotel.rooms.length === 0) {
    throw new Error(`Hotel ${hotel.name} (ID: ${hotel.id}) has no rooms available`);
  }

  // Prioridad 1: Type guard para HotelDataWithSelectedRoom
  if ('selectedRoom' in hotel && hotel.selectedRoom) {
    console.log(`💰 [PRICE_CALC] Hotel ${hotel.name}: Using selectedRoom property`, {
      room_type: hotel.selectedRoom.type,
      total_price: hotel.selectedRoom.total_price,
      source: 'selected'
    });

    return {
      room: hotel.selectedRoom,
      source: 'selected'
    };
  }

  // Prioridad 2: Buscar por selectedRoomId
  if (selectedRoomId) {
    const selectedRoom = hotel.rooms.find(r => r.occupancy_id === selectedRoomId);

    if (selectedRoom) {
      console.log(`💰 [PRICE_CALC] Hotel ${hotel.name}: Found room by ID`, {
        room_id: selectedRoomId,
        room_type: selectedRoom.type,
        total_price: selectedRoom.total_price,
        source: 'selected'
      });

      return {
        room: selectedRoom,
        source: 'selected'
      };
    } else {
      console.warn(`⚠️ [PRICE_CALC] Room ${selectedRoomId} not found in hotel ${hotel.name}, using fallback`);
    }
  }

  // Prioridad 3: Buscar habitación más barata (fallback inteligente)
  const cheapestRoom = hotel.rooms.reduce((cheapest, room) => {
    const cheapestPrice = cheapest.total_price || Infinity;
    const currentPrice = room.total_price || Infinity;
    return currentPrice < cheapestPrice ? room : cheapest;
  });

  console.log(`💰 [PRICE_CALC] Hotel ${hotel.name}: Using cheapest room fallback`, {
    room_type: cheapestRoom.type,
    total_price: cheapestRoom.total_price,
    source: 'cheapest'
  });

  return {
    room: cheapestRoom,
    source: 'cheapest'
  };
}

/**
 * Calcula el precio de un hotel usando la habitación correcta
 *
 * IMPORTANTE: Usa room.total_price directamente ya que EUROVIPS lo calcula
 * para todas las noches. NO multiplicar por hotel.nights.
 *
 * @param hotel - Datos del hotel
 * @param selectedRoomId - ID opcional de habitación seleccionada
 * @returns Resultado con total, moneda, habitación usada y fuente
 */
export function calculateHotelPrice(
  hotel: HotelData | HotelDataWithSelectedRoom,
  selectedRoomId?: string
): HotelPriceResult {
  // Extraer habitación correcta
  const { room, source } = extractRoomForCalculation(hotel, selectedRoomId);

  // IMPORTANTE: total_price ya incluye todas las noches (calculado por EUROVIPS)
  const total = room.total_price || 0;
  const currency = room.currency || 'USD';
  const nights = hotel.nights || 1;
  const pricePerNight = nights > 0 ? total / nights : total;

  // Warning si el precio es null/undefined
  if (!room.total_price) {
    console.warn(`⚠️ [PRICE_CALC] Hotel ${hotel.name} has null/undefined price`, {
      room_type: room.type,
      total_price: room.total_price
    });
  }

  const result: HotelPriceResult = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    total,
    currency,
    room,
    source,
    nights,
    pricePerNight
  };

  console.log(`💰 [PRICE_CALC] Hotel ${hotel.name} calculation complete:`, {
    total,
    currency,
    room_type: room.type,
    source,
    nights,
    price_per_night: pricePerNight
  });

  return result;
}

/**
 * Calcula el precio de un vuelo
 *
 * Maneja tanto price.amount como number o string.
 * Usa parseCurrency() para strings.
 *
 * @param flight - Datos del vuelo
 * @returns Resultado con total y moneda
 */
export function calculateFlightPrice(flight: FlightData): FlightPriceResult {
  // Extraer precio (puede ser number o string)
  let amount: number;

  if (typeof flight.price?.amount === 'string') {
    amount = parseCurrency(flight.price.amount);
  } else if (typeof flight.price?.amount === 'number') {
    amount = flight.price.amount;
  } else {
    console.warn(`⚠️ [PRICE_CALC] Flight ${flight.id} has invalid price:`, flight.price);
    amount = 0;
  }

  const currency = flight.price?.currency || 'USD';
  const airline = flight.airline?.name || 'Unknown';

  const result: FlightPriceResult = {
    flightId: flight.id || 'unknown',
    airline,
    total: amount,
    currency
  };

  console.log(`💰 [PRICE_CALC] Flight ${flight.id} calculation complete:`, {
    airline,
    total: amount,
    currency
  });

  return result;
}

/**
 * Calcula el precio total de vuelos + hoteles con breakdown detallado
 *
 * @param flights - Array de vuelos seleccionados
 * @param hotels - Array de hoteles seleccionados
 * @param selectedRooms - Mapa opcional de hotelId → roomId
 * @returns Breakdown completo con subtotales y total general
 */
export function calculateTotalPrice(
  flights: FlightData[],
  hotels: (HotelData | HotelDataWithSelectedRoom)[],
  selectedRooms?: Record<string, string>
): TotalPriceBreakdown {
  console.log(`💰 [PRICE_CALC] Starting total price calculation:`, {
    flights_count: flights.length,
    hotels_count: hotels.length,
    has_selected_rooms: !!selectedRooms
  });

  const warnings: string[] = [];

  // Calcular precios de vuelos
  const flightResults: FlightPriceResult[] = [];
  let flightSubtotal = 0;

  flights.forEach(flight => {
    try {
      const flightPrice = calculateFlightPrice(flight);
      flightResults.push(flightPrice);
      flightSubtotal += flightPrice.total;
    } catch (error) {
      console.error(`❌ [PRICE_CALC] Error calculating flight ${flight.id}:`, error);
      warnings.push(`Flight ${flight.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Calcular precios de hoteles
  const hotelResults: HotelPriceResult[] = [];
  let hotelSubtotal = 0;

  hotels.forEach(hotel => {
    try {
      const selectedRoomId = selectedRooms?.[hotel.id];
      const hotelPrice = calculateHotelPrice(hotel, selectedRoomId);
      hotelResults.push(hotelPrice);
      hotelSubtotal += hotelPrice.total;
    } catch (error) {
      console.error(`❌ [PRICE_CALC] Error calculating hotel ${hotel.id}:`, error);
      warnings.push(`Hotel ${hotel.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Calcular total general
  const grandTotal = flightSubtotal + hotelSubtotal;

  // Detectar monedas mixtas
  const allCurrencies = [
    ...flightResults.map(f => f.currency),
    ...hotelResults.map(h => h.currency)
  ];
  const uniqueCurrencies = [...new Set(allCurrencies)];

  if (uniqueCurrencies.length > 1) {
    warnings.push(`Mixed currencies detected: ${uniqueCurrencies.join(', ')}. Using first currency found.`);
  }

  const currency = uniqueCurrencies[0] || 'USD';

  const breakdown: TotalPriceBreakdown = {
    flights: flightResults,
    hotels: hotelResults,
    flightSubtotal,
    hotelSubtotal,
    grandTotal,
    currency,
    warnings
  };

  console.log(`💰 [PRICE_CALC] Total calculation complete:`, {
    flight_subtotal: flightSubtotal,
    hotel_subtotal: hotelSubtotal,
    grand_total: grandTotal,
    currency,
    warnings_count: warnings.length
  });

  if (warnings.length > 0) {
    console.warn(`⚠️ [PRICE_CALC] Warnings:`, warnings);
  }

  return breakdown;
}

/**
 * Genera breakdown detallado para display y debugging
 * (Alias de calculateTotalPrice con mismo comportamiento)
 */
export const generatePriceBreakdown = calculateTotalPrice;
