import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveHotelCode } from "../../_shared/cityCodeResolver.ts";
import { detectBudgetFromText, getBudgetConstraints, type BudgetLevel } from "../../_shared/budgetHotelMap.ts";
import type { ToolDefinition, ToolResult } from "../types.ts";
import type { AgentBudgetContext } from "./registry.ts";

export function createSearchHotelsTool(supabase: SupabaseClient, budgetContext?: AgentBudgetContext): ToolDefinition {
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

        // Resolve budget: user message NLP > userPreferences > 'mid'
        const detected = budgetContext?.userMessage
          ? detectBudgetFromText(budgetContext.userMessage)
          : { level: null, maxPricePerNight: null };
        const effectiveBudgetLevel: BudgetLevel = (detected.level
          ?? budgetContext?.budgetLevel
          ?? 'mid') as BudgetLevel;
        const constraints = getBudgetConstraints(effectiveBudgetLevel);
        const effectiveMaxPrice = detected.maxPricePerNight ?? constraints.maxPricePerNight;

        console.log(`[PLANNER AGENT] Budget: ${effectiveBudgetLevel} (${constraints.label}), maxPrice: $${effectiveMaxPrice}/night, maxStars: ${constraints.maxStars}`);

        // Resolve hotel city code
        const cityCode = resolveHotelCode(city);

        const eurovipsData: Record<string, unknown> = {
          action: 'searchHotels',
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

        // Extract hotel summaries with budget filtering
        interface RawHotelRoom { total_price?: number; TotalPrice?: number; currency?: string; Currency?: string; meal_plan?: string; MealPlan?: string; room_type?: string; RoomType?: string }
        interface RawHotel { hotel_name?: string; HotelName?: string; name?: string; category?: number; Category?: number; stars?: number; city?: string; City?: string; rooms?: RawHotelRoom[]; Rooms?: RawHotelRoom[] }

        const allMapped = (hotels as RawHotel[]).map((h, i) => {
          const rooms = h.rooms || h.Rooms || [];
          const cheapestRoom = rooms.reduce<RawHotelRoom | undefined>((min, r) => {
            const price = r.total_price || r.TotalPrice || Infinity;
            const minPrice = min?.total_price || min?.TotalPrice || Infinity;
            return price < minPrice ? r : min;
          }, rooms[0]);

          const totalPrice = cheapestRoom?.total_price || cheapestRoom?.TotalPrice || 0;
          const checkin = new Date(checkinDate);
          const checkout = new Date(checkoutDate);
          const nights = Math.max(1, Math.round((checkout.getTime() - checkin.getTime()) / 86400000));
          const pricePerNight = totalPrice > 0 ? Math.round(totalPrice / nights) : 0;
          const stars = h.category || h.Category || h.stars || 0;

          return {
            index: i + 1,
            name: h.hotel_name || h.HotelName || h.name || 'N/A',
            category: stars,
            city: h.city || h.City || city,
            price: totalPrice,
            pricePerNight,
            currency: cheapestRoom?.currency || cheapestRoom?.Currency || 'USD',
            mealPlan: cheapestRoom?.meal_plan || cheapestRoom?.MealPlan || 'N/A',
            roomType: cheapestRoom?.room_type || cheapestRoom?.RoomType || 'N/A',
            _raw: h,
          };
        });

        // Filter by budget constraints
        let filtered = allMapped.filter(h => {
          if (h.pricePerNight > 0 && h.pricePerNight > effectiveMaxPrice) return false;
          if (h.category > 0 && h.category > constraints.maxStars) return false;
          return true;
        });

        // If filtering left no results, fall back to all results
        const budgetFiltered = filtered.length > 0;
        if (!budgetFiltered) {
          console.warn(`[PLANNER AGENT] Budget filter (${effectiveBudgetLevel}) returned 0 results, using unfiltered`);
          filtered = allMapped;
        }

        // Rank: best value (stars/price ratio), then by price ascending
        const ranked = filtered
          .sort((a, b) => {
            if (a.pricePerNight > 0 && b.pricePerNight > 0) {
              const valueA = (a.category || 3) / a.pricePerNight;
              const valueB = (b.category || 3) / b.pricePerNight;
              return valueB - valueA;
            }
            return (a.pricePerNight || 999) - (b.pricePerNight || 999);
          })
          .slice(0, 5);

        // Build clean summaries (strip _raw for LLM)
        const topHotels = ranked.map(({ _raw: _, ...rest }, i) => ({ ...rest, index: i + 1 }));
        const rawSlice = ranked.map(h => h._raw);

        console.log(`[PLANNER AGENT] Found ${hotels.length} hotels, budget-filtered: ${budgetFiltered}, returning top ${topHotels.length}`);

        return {
          success: true,
          data: {
            totalFound: hotels.length,
            hotels: topHotels,
            searchParams: {
              city,
              cityCode,
              checkinDate,
              checkoutDate,
              adults,
              children,
              infants,
              budgetLevel: effectiveBudgetLevel,
              budgetLabel: constraints.label,
              maxPricePerNight: effectiveMaxPrice,
            },
            rawHotels: rawSlice,
          }
        };
      } catch (err: unknown) {
        console.error('[PLANNER AGENT] search_hotels exception:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Error inesperado buscando hoteles' };
      }
    }
  };
}
