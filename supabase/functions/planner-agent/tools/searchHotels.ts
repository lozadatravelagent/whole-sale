import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveHotelCode } from "../../_shared/cityCodeResolver.ts";
import type { ToolDefinition, ToolResult } from "../types.ts";

export function createSearchHotelsTool(supabase: SupabaseClient): ToolDefinition {
  return {
    name: 'search_hotels',
    description: 'Busca hoteles disponibles en una ciudad. Requiere ciudad, fecha de check-in, fecha de check-out y número de adultos. Opcionalmente acepta niños, edades de niños, nombre de hotel, cadenas hoteleras y régimen de comidas.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Ciudad de destino (ej: "Barcelona", "Punta Cana")' },
        checkinDate: { type: 'string', description: 'Fecha de check-in en formato YYYY-MM-DD' },
        checkoutDate: { type: 'string', description: 'Fecha de check-out en formato YYYY-MM-DD' },
        adults: { type: 'number', description: 'Número de adultos (mínimo 1)' },
        children: { type: 'number', description: 'Número de niños' },
        infants: { type: 'number', description: 'Número de infantes' },
        childrenAges: { type: 'array', items: { type: 'number' }, description: 'Edades de los niños' },
        hotelName: { type: 'string', description: 'Nombre específico de hotel a buscar' },
        hotelChains: { type: 'array', items: { type: 'string' }, description: 'Cadenas hoteleras preferidas (ej: ["RIU", "Iberostar"])' },
        mealPlan: { type: 'string', description: 'Régimen de comidas: "all_inclusive", "breakfast", "half_board", "full_board"' },
      },
      required: ['city', 'checkinDate', 'checkoutDate', 'adults'],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        console.log('[PLANNER AGENT] search_hotels called with:', params);

        const city = params.city as string;
        const checkinDate = params.checkinDate as string;
        const checkoutDate = params.checkoutDate as string;
        const adults = (params.adults as number) || 1;
        const children = (params.children as number) || 0;
        const infants = (params.infants as number) || 0;
        const childrenAges = (params.childrenAges as number[]) || [];
        const hotelName = params.hotelName as string | undefined;
        const hotelChains = params.hotelChains as string[] | undefined;
        const mealPlan = params.mealPlan as string | undefined;

        // Resolve hotel city code
        const cityCode = resolveHotelCode(city);

        const eurovipsData: Record<string, unknown> = {
          action: 'searchHotelFares',
          data: {
            CityCode: cityCode,
            CheckIn: checkinDate,
            CheckOut: checkoutDate,
            Rooms: [{
              Adults: adults,
              Children: children,
              ChildrenAges: childrenAges,
              Infants: infants,
            }],
            Currency: 'USD',
            Language: 'es',
            ...(hotelName && { hotelName }),
            ...(hotelChains && hotelChains.length > 0 && { hotelChains }),
            ...(mealPlan && { mealPlan }),
          }
        };

        console.log('[PLANNER AGENT] Invoking eurovips-soap with:', eurovipsData);

        const { data, error } = await supabase.functions.invoke('eurovips-soap', {
          body: eurovipsData
        });

        if (error) {
          console.error('[PLANNER AGENT] eurovips-soap error:', error);
          return { success: false, error: `Error buscando hoteles: ${error.message}` };
        }

        const rawHotels = data?.results || data?.data || data || [];
        const hotels = Array.isArray(rawHotels) ? rawHotels : [];

        // Extract top 5 hotels summary
        const topHotels = hotels.slice(0, 5).map((h: any, i: number) => {
          const rooms = h.rooms || h.Rooms || [];
          const cheapestRoom = rooms.reduce((min: any, r: any) => {
            const price = r.total_price || r.TotalPrice || Infinity;
            const minPrice = min?.total_price || min?.TotalPrice || Infinity;
            return price < minPrice ? r : min;
          }, rooms[0]);

          return {
            index: i + 1,
            name: h.hotel_name || h.HotelName || h.name || 'N/A',
            category: h.category || h.Category || h.stars || 0,
            city: h.city || h.City || city,
            price: cheapestRoom?.total_price || cheapestRoom?.TotalPrice || 0,
            currency: cheapestRoom?.currency || cheapestRoom?.Currency || 'USD',
            mealPlan: cheapestRoom?.meal_plan || cheapestRoom?.MealPlan || 'N/A',
            roomType: cheapestRoom?.room_type || cheapestRoom?.RoomType || 'N/A',
          };
        });

        console.log(`[PLANNER AGENT] Found ${hotels.length} hotels, returning top ${topHotels.length}`);

        return {
          success: true,
          data: {
            totalFound: hotels.length,
            hotels: topHotels,
            searchParams: { city, cityCode, checkinDate, checkoutDate, adults, children, infants },
            rawHotels: hotels.slice(0, 5),
          }
        };
      } catch (err: any) {
        console.error('[PLANNER AGENT] search_hotels exception:', err);
        return { success: false, error: err.message || 'Error inesperado buscando hoteles' };
      }
    }
  };
}
