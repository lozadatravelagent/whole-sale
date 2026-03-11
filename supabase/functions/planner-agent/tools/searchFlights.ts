import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveFlightCodes } from "../../_shared/cityCodeResolver.ts";
import type { ToolDefinition, ToolResult } from "../types.ts";

export function createSearchFlightsTool(supabase: SupabaseClient): ToolDefinition {
  return {
    name: 'search_flights',
    description: 'Busca vuelos disponibles entre dos ciudades. Requiere origen, destino, fecha de ida y número de adultos. Opcionalmente acepta fecha de vuelta, niños, infantes, preferencia de escalas y aerolínea preferida.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Ciudad de origen (ej: "Buenos Aires", "Madrid")' },
        destination: { type: 'string', description: 'Ciudad de destino (ej: "Barcelona", "Cancún")' },
        departureDate: { type: 'string', description: 'Fecha de ida en formato YYYY-MM-DD' },
        returnDate: { type: 'string', description: 'Fecha de vuelta en formato YYYY-MM-DD (opcional para ida y vuelta)' },
        adults: { type: 'number', description: 'Número de adultos (mínimo 1)' },
        children: { type: 'number', description: 'Número de niños (2-11 años)' },
        infants: { type: 'number', description: 'Número de infantes (0-1 año)' },
        stops: { type: 'string', description: 'Preferencia de escalas: "direct", "one_stop", "any"' },
        preferredAirline: { type: 'string', description: 'Aerolínea preferida (ej: "Iberia", "LATAM")' },
      },
      required: ['origin', 'destination', 'departureDate', 'adults'],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        console.log('[PLANNER AGENT] search_flights called with:', params);

        const origin = params.origin as string;
        const destination = params.destination as string;
        const departureDate = params.departureDate as string;
        const returnDate = params.returnDate as string | undefined;
        const adults = (params.adults as number) || 1;
        const children = (params.children as number) || 0;
        const infants = (params.infants as number) || 0;
        const stops = params.stops as string | undefined;
        const preferredAirline = params.preferredAirline as string | undefined;

        // Resolve IATA codes
        const { originCode, destinationCode } = resolveFlightCodes(origin, destination);

        // Build Starling API params
        const passengers: Array<{ Count: number; Type: string }> = [];
        if (adults > 0) passengers.push({ Count: adults, Type: 'ADT' });
        if (children > 0) passengers.push({ Count: children, Type: 'CHD' });
        if (infants > 0) passengers.push({ Count: infants, Type: 'INF' });

        const legs: Array<{ DepartureAirportCity: string; ArrivalAirportCity: string; FlightDate: string }> = [
          { DepartureAirportCity: originCode, ArrivalAirportCity: destinationCode, FlightDate: departureDate }
        ];

        if (returnDate) {
          legs.push({ DepartureAirportCity: destinationCode, ArrivalAirportCity: originCode, FlightDate: returnDate });
        }

        const starlingData: Record<string, unknown> = { Passengers: passengers, Legs: legs };
        if (stops === 'direct') starlingData.stops = 'direct';
        if (preferredAirline) starlingData.Airlines = [preferredAirline];

        console.log('[PLANNER AGENT] Invoking starling-flights with:', starlingData);

        const { data, error } = await supabase.functions.invoke('starling-flights', {
          body: { action: 'searchFlights', data: starlingData }
        });

        if (error) {
          console.error('[PLANNER AGENT] starling-flights error:', error);
          return { success: false, error: `Error buscando vuelos: ${error.message}` };
        }

        const rawFlights = data?.data || data;
        const flights = Array.isArray(rawFlights) ? rawFlights : rawFlights?.Fares || rawFlights?.flights || [];

        // Extract top 5 flights summary
        const topFlights = flights.slice(0, 5).map((f: any, i: number) => {
          const firstLeg = f.legs?.[0] || f.Legs?.[0] || {};
          const segments = firstLeg.segments || firstLeg.Segments || [];
          const firstSeg = segments[0] || {};
          const lastSeg = segments[segments.length - 1] || {};

          return {
            index: i + 1,
            price: f.price?.amount || f.Price?.Amount || f.total_price || 0,
            currency: f.price?.currency || f.Price?.Currency || 'USD',
            airline: firstSeg.airline?.name || firstSeg.Airline?.Name || firstSeg.carrier || 'N/A',
            stops: Math.max(0, segments.length - 1),
            departure: firstSeg.departure || firstSeg.Departure || {},
            arrival: lastSeg.arrival || lastSeg.Arrival || {},
          };
        });

        console.log(`[PLANNER AGENT] Found ${flights.length} flights, returning top ${topFlights.length}`);

        return {
          success: true,
          data: {
            totalFound: flights.length,
            flights: topFlights,
            searchParams: { origin, destination, originCode, destinationCode, departureDate, returnDate, adults, children, infants },
            rawFlights: flights.slice(0, 5),
          }
        };
      } catch (err: any) {
        console.error('[PLANNER AGENT] search_flights exception:', err);
        return { success: false, error: err.message || 'Error inesperado buscando vuelos' };
      }
    }
  };
}
