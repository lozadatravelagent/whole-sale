import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveHotelCode } from "../../_shared/cityCodeResolver.ts";
import type { ToolDefinition, ToolResult } from "../types.ts";

export function createSearchPackagesTool(supabase: SupabaseClient): ToolDefinition {
  return {
    name: 'search_packages',
    description: 'Busca paquetes turísticos disponibles en una ciudad. Los paquetes pueden incluir vuelos, hotel, comidas, traslados y excursiones. Requiere destino, fecha desde, fecha hasta.',
    inputSchema: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Ciudad de destino (ej: "Bariloche", "Punta Cana")' },
        dateFrom: { type: 'string', description: 'Fecha desde en formato YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'Fecha hasta en formato YYYY-MM-DD' },
        packageClass: {
          type: 'string',
          enum: ['AEROTERRESTRE', 'TERRESTRE', 'AEREO'],
          description: 'Tipo de paquete: AEROTERRESTRE (vuelo+hotel), TERRESTRE (solo hotel), AEREO (solo vuelo)',
        },
      },
      required: ['destination', 'dateFrom', 'dateTo'],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        console.log('[PLANNER AGENT] search_packages called with:', params);

        const destination = params.destination as string;
        const dateFrom = params.dateFrom as string;
        const dateTo = params.dateTo as string;
        const packageClass = (params.packageClass as string) || 'AEROTERRESTRE';

        const cityCode = resolveHotelCode(destination);

        const { data, error } = await supabase.functions.invoke('eurovips-soap', {
          body: {
            action: 'searchPackages',
            data: { cityCode, dateFrom, dateTo, packageClass },
          },
        });

        if (error) {
          console.error('[PLANNER AGENT] eurovips-soap packages error:', error);
          return { success: false, error: `Error buscando paquetes: ${error.message}` };
        }

        const rawPackages = data?.results || data?.data || data || [];
        const packages = Array.isArray(rawPackages) ? rawPackages : [];

        const topPackages = packages
          .sort((a: any, b: any) => (a.price?.amount || 0) - (b.price?.amount || 0))
          .slice(0, 5)
          .map((p: any, i: number) => ({
            index: i + 1,
            name: p.name || 'N/A',
            destination: p.destination || destination,
            durationNights: p.duration_nights || 0,
            durationDays: p.duration_days || 0,
            departureDate: p.departure_date || dateFrom,
            returnDate: p.return_date || dateTo,
            price: p.price?.amount || 0,
            currency: p.price?.currency || 'USD',
            includes: p.includes || {},
            includedServices: p.included_services || [],
          }));

        console.log(`[PLANNER AGENT] Found ${packages.length} packages, returning top ${topPackages.length}`);

        return {
          success: true,
          data: {
            totalFound: packages.length,
            packages: topPackages,
            searchParams: { destination, cityCode, dateFrom, dateTo, packageClass },
            rawPackages: packages.slice(0, 5),
          },
        };
      } catch (err: any) {
        console.error('[PLANNER AGENT] search_packages exception:', err);
        return { success: false, error: err.message || 'Error inesperado buscando paquetes' };
      }
    },
  };
}
