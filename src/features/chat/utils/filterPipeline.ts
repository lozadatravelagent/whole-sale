import type { FlightData } from '@/types';
import type { FilterState, Distribution } from '../types/searchCache';

const TOP_N_DISPLAY = 5;

/**
 * Aplica todos los filtros activos a la lista de vuelos
 */
export function applyFilters(
  results: FlightData[],
  filters: FilterState
): FlightData[] {
  let filtered = [...results];

  // Filtrar por aerolíneas
  if (filters.airlines?.length) {
    filtered = filtered.filter(flight =>
      filters.airlines!.includes(flight.airline.code)
    );
  }

  // Filtrar por escalas
  // 0 = Directo (exactamente 0 escalas por tramo)
  // 1 = 1 escala (exactamente 1 escala máxima por tramo)
  // 2 = 2+ escalas (2 o más escalas en algún tramo)
  if (filters.maxStops !== null) {
    filtered = filtered.filter(flight => {
      const maxStopsInFlight = getMaxStops(flight);

      if (filters.maxStops === 0) {
        // Directo: ambos tramos sin escalas
        return maxStopsInFlight === 0;
      } else if (filters.maxStops === 1) {
        // 1 escala: máximo 1 escala en cualquier tramo
        return maxStopsInFlight === 1;
      } else {
        // 2+ escalas: 2 o más escalas en algún tramo
        return maxStopsInFlight >= 2;
      }
    });
  }

  // Filtrar por horario de salida
  if (filters.departureTimeRange) {
    const [minTime, maxTime] = filters.departureTimeRange;
    filtered = filtered.filter(flight => {
      const departureTime = getFirstDepartureTime(flight);
      return departureTime >= minTime && departureTime <= maxTime;
    });
  }

  // Filtrar por horario de llegada
  if (filters.arrivalTimeRange) {
    const [minTime, maxTime] = filters.arrivalTimeRange;
    filtered = filtered.filter(flight => {
      const arrivalTime = getLastArrivalTime(flight);
      return arrivalTime >= minTime && arrivalTime <= maxTime;
    });
  }

  // Filtrar por equipaje incluido
  if (filters.includeBaggage === true) {
    filtered = filtered.filter(flight => flight.luggage === true);
  }

  // Filtrar por duración máxima de escala
  if (filters.maxLayoverHours !== null) {
    filtered = filtered.filter(flight => {
      const maxLayover = getMaxLayoverDuration(flight);
      return maxLayover <= filters.maxLayoverHours!;
    });
  }

  return filtered;
}

/**
 * Aplica filtros, ordena por precio y limita a Top N
 */
export function applyPipelineAndLimit(
  results: FlightData[],
  filters: FilterState,
  limit: number = TOP_N_DISPLAY
): FlightData[] {
  const filtered = applyFilters(results, filters);

  // Ordenar por precio (más barato primero)
  const sorted = [...filtered].sort(
    (a, b) => (a.price.amount || 0) - (b.price.amount || 0)
  );

  // Retornar Top N
  return sorted.slice(0, limit);
}

/**
 * Calcula la distribución de resultados para mostrar en chips
 */
export function calculateDistribution(results: FlightData[]): Distribution {
  const airlines: Record<string, number> = {};
  const stops: Record<number, number> = {};
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  for (const flight of results) {
    // Contar por aerolínea
    const airlineCode = flight.airline.code;
    airlines[airlineCode] = (airlines[airlineCode] || 0) + 1;

    // Contar por escalas
    const stopsCount = getMaxStops(flight);
    stops[stopsCount] = (stops[stopsCount] || 0) + 1;

    // Calcular rango de precios
    const price = flight.price.amount || 0;
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;

    // Contar por franja horaria de salida
    const departureTime = getFirstDepartureTime(flight);
    const hour = Math.floor(departureTime / 100);

    if (hour >= 6 && hour < 12) {
      timeSlots.morning++;
    } else if (hour >= 12 && hour < 18) {
      timeSlots.afternoon++;
    } else if (hour >= 18 && hour < 22) {
      timeSlots.evening++;
    } else {
      timeSlots.night++;
    }
  }

  return {
    airlines,
    stops,
    priceRange: [minPrice === Infinity ? 0 : minPrice, maxPrice === -Infinity ? 0 : maxPrice],
    departureTimeSlots: timeSlots,
  };
}

/**
 * Retorna filtros por defecto (sin ningún filtro activo)
 */
export function getDefaultFilters(): FilterState {
  return {
    airlines: null,
    maxStops: null,
    departureTimeRange: null,
    arrivalTimeRange: null,
    includeBaggage: null,
    maxLayoverHours: null,
  };
}

// ============ Helpers ============

/**
 * Obtiene el MÁXIMO de escalas en cualquier tramo individual del vuelo
 *
 * Lógica de categorización:
 * - Directo: maxStopsPerLeg = 0 (ambos tramos son directos)
 * - 1 escala: maxStopsPerLeg = 1 (ningún tramo tiene más de 1 escala)
 * - 2+ escalas: maxStopsPerLeg >= 2 (algún tramo tiene 2 o más escalas)
 *
 * Ejemplo:
 * - IDA: 0, REGRESO: 0 → 0 (Directo)
 * - IDA: 1, REGRESO: 0 → 1 (1 escala)
 * - IDA: 1, REGRESO: 1 → 1 (1 escala)
 * - IDA: 2, REGRESO: 0 → 2 (2+ escalas)
 * - IDA: 1, REGRESO: 2 → 2 (2+ escalas)
 */
function getMaxStops(flight: FlightData): number {
  let maxStopsPerLeg = 0;

  for (const leg of flight.legs || []) {
    let legStops = 0;

    // Estructura local: legs[].options[].segments[]
    if ('options' in leg && Array.isArray((leg as any).options)) {
      const options = (leg as any).options;

      for (const option of options) {
        const segments = option.segments || [];

        // Conexiones entre segmentos (cambios de avión)
        const segmentConnections = Math.max(0, segments.length - 1);

        // Escalas técnicas dentro de cada segmento
        let technicalStops = 0;
        for (const segment of segments) {
          technicalStops += (segment.stops?.length || 0);
        }

        const optionStops = segmentConnections + technicalStops;
        if (optionStops > legStops) legStops = optionStops;
      }
    }
    // Estructura global: legs[].layovers
    else if ('layovers' in leg) {
      legStops = (leg as any).layovers?.length || 0;
    }

    // Guardar el máximo entre todos los legs
    if (legStops > maxStopsPerLeg) {
      maxStopsPerLeg = legStops;
    }
  }

  return maxStopsPerLeg;
}

/**
 * Obtiene la hora de salida del primer tramo como número HHMM
 * Ej: "08:30" -> 830
 * Maneja tanto estructura global como local
 */
function getFirstDepartureTime(flight: FlightData): number {
  if (!flight.legs?.length) return 0;

  const firstLeg = flight.legs[0];

  // Estructura local: legs[].options[].segments[].departure.time
  if ('options' in firstLeg && Array.isArray((firstLeg as any).options)) {
    const firstOption = (firstLeg as any).options?.[0];
    const firstSegment = firstOption?.segments?.[0];
    return timeStringToNumber(firstSegment?.departure?.time);
  }

  // Estructura global: legs[].departure.time
  if ('departure' in firstLeg && (firstLeg as any).departure?.time) {
    return timeStringToNumber((firstLeg as any).departure.time);
  }

  return 0;
}

/**
 * Obtiene la hora de llegada del último tramo como número HHMM
 * Maneja tanto estructura global como local
 */
function getLastArrivalTime(flight: FlightData): number {
  if (!flight.legs?.length) return 0;

  const lastLeg = flight.legs[flight.legs.length - 1];

  // Estructura local: legs[].options[].segments[].arrival.time
  if ('options' in lastLeg && Array.isArray((lastLeg as any).options)) {
    const firstOption = (lastLeg as any).options?.[0];
    const segments = firstOption?.segments;
    const lastSegment = segments?.[segments.length - 1];
    return timeStringToNumber(lastSegment?.arrival?.time);
  }

  // Estructura global: legs[].arrival.time
  if ('arrival' in lastLeg && (lastLeg as any).arrival?.time) {
    return timeStringToNumber((lastLeg as any).arrival.time);
  }

  return 0;
}

/**
 * Convierte string de hora "HH:MM" a número HHMM
 * Ej: "08:30" -> 830, "14:45" -> 1445
 */
function timeStringToNumber(timeStr: string): number {
  if (!timeStr) return 0;

  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 100 + (minutes || 0);
}

/**
 * Convierte número HHMM a string "HH:MM"
 * Ej: 830 -> "08:30", 1445 -> "14:45"
 */
export function timeNumberToString(time: number): string {
  const hours = Math.floor(time / 100);
  const minutes = time % 100;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Obtiene el nombre de la franja horaria
 */
export function getTimeSlotName(slot: keyof Distribution['departureTimeSlots']): string {
  const names: Record<string, string> = {
    morning: 'Mañana (6-12h)',
    afternoon: 'Tarde (12-18h)',
    evening: 'Noche (18-22h)',
    night: 'Madrugada (22-6h)',
  };
  return names[slot] || slot;
}

/**
 * Obtiene la duración máxima de escala en horas para un vuelo
 *
 * Calcula el tiempo de espera entre segmentos consecutivos dentro de cada tramo,
 * y retorna el máximo en horas.
 *
 * @param flight - El vuelo a analizar
 * @returns Duración máxima de escala en horas
 */
function getMaxLayoverDuration(flight: FlightData): number {
  let maxLayoverHours = 0;

  for (const leg of flight.legs || []) {
    // Estructura local: legs[].options[].segments[]
    if ('options' in leg && Array.isArray((leg as any).options)) {
      const options = (leg as any).options;

      for (const option of options) {
        const segments = option.segments || [];

        // Calcular duración de escala entre segmentos consecutivos
        for (let i = 0; i < segments.length - 1; i++) {
          const currentSegment = segments[i];
          const nextSegment = segments[i + 1];

          if (currentSegment.arrival?.dateTime && nextSegment.departure?.dateTime) {
            const arrivalTime = new Date(currentSegment.arrival.dateTime).getTime();
            const departureTime = new Date(nextSegment.departure.dateTime).getTime();

            // Duración de escala en horas
            const layoverHours = (departureTime - arrivalTime) / (1000 * 60 * 60);

            if (layoverHours > maxLayoverHours) {
              maxLayoverHours = layoverHours;
            }
          }
        }
      }
    }
    // Estructura global: legs[].layovers[] con duration
    else if ('layovers' in leg && Array.isArray((leg as any).layovers)) {
      const layovers = (leg as any).layovers;

      for (const layover of layovers) {
        if (layover.duration) {
          // Asumir que duration está en minutos o en formato "XXh YYm"
          let hours = 0;

          if (typeof layover.duration === 'number') {
            hours = layover.duration / 60; // Convertir minutos a horas
          } else if (typeof layover.duration === 'string') {
            // Parsear formato "2h 30m" o "150m"
            const hourMatch = layover.duration.match(/(\d+)h/);
            const minMatch = layover.duration.match(/(\d+)m/);

            if (hourMatch) hours += parseInt(hourMatch[1], 10);
            if (minMatch) hours += parseInt(minMatch[1], 10) / 60;
          }

          if (hours > maxLayoverHours) {
            maxLayoverHours = hours;
          }
        }
      }
    }
  }

  return maxLayoverHours;
}
