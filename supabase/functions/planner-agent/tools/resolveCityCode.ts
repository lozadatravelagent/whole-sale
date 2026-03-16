import { resolveAirportCode, resolveHotelCode } from "../../_shared/cityCodeResolver.ts";
import type { ToolDefinition, ToolResult } from "../types.ts";

export function createResolveCityCodeTool(): ToolDefinition {
  return {
    name: 'resolve_city_code',
    description: 'Resuelve el nombre de una ciudad a su código IATA (para vuelos) y código de hotel (para hoteles). Útil para validar que una ciudad es reconocida antes de buscar.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Nombre de la ciudad (ej: "Buenos Aires", "Punta Cana")' },
        destination: { type: 'string', description: 'Ciudad de destino (opcional, ayuda a resolver aeropuertos domésticos vs internacionales)' },
      },
      required: ['city'],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        const city = params.city as string;
        const destination = params.destination as string | undefined;

        const airportCode = resolveAirportCode(city, destination);
        const hotelCode = resolveHotelCode(city);

        return {
          success: true,
          data: { city, airportCode, hotelCode },
        };
      } catch (err: unknown) {
        return { success: false, error: `No se pudo resolver la ciudad "${params.city}": ${err instanceof Error ? err.message : 'error desconocido'}` };
      }
    },
  };
}
