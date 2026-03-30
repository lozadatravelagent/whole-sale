import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ToolDefinition, ToolResult } from "../types.ts";

const GENERIC_PREFIXES = [
  'paseo por', 'recorrido por', 'caminata por', 'visita por',
  'cena en zona', 'cena tranquila', 'almuerzo en zona', 'desayuno en el hotel',
  'comida en zona', 'tarde libre', 'mañana libre', 'día libre', 'tiempo libre',
  'traslado a', 'traslado al', 'traslado desde',
  'check-in', 'check-out', 'llegada a', 'salida de',
  'descanso en', 'relax en', 'noche en el hotel', 'noche libre',
  'walking tour of', 'stroll through', 'walk around',
  'local dinner', 'dinner at a', 'lunch at a', 'breakfast at the',
  'cultural visit', 'free time', 'free afternoon', 'free morning',
  'transfer to', 'arrival at', 'departure from', 'rest at hotel',
];

function isGenericPlaceholder(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 4) return true;
  return GENERIC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function createGenerateItineraryTool(supabase: SupabaseClient): ToolDefinition {
  return {
    name: 'generate_itinerary',
    description: 'Genera un itinerario de viaje día por día para uno o más destinos. Incluye actividades, restaurantes y tips. Útil cuando el usuario pide un plan de viaje detallado.',
    inputSchema: {
      type: 'object',
      properties: {
        destinations: {
          type: 'array', items: { type: 'string' },
          description: 'Ciudades del viaje en orden (ej: ["Buenos Aires", "Mendoza"])',
        },
        startDate: { type: 'string', description: 'Fecha de inicio YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Fecha de fin YYYY-MM-DD' },
        days: { type: 'number', description: 'Duración total en días (alternativa a endDate)' },
        adults: { type: 'number', description: 'Número de adultos' },
        children: { type: 'number', description: 'Número de niños' },
        interests: {
          type: 'array', items: { type: 'string' },
          description: 'Intereses del viajero (ej: ["cultura", "gastronomía", "aventura"])',
        },
        pace: { type: 'string', description: 'Ritmo del viaje: "relaxed", "moderate", "active"' },
        budgetLevel: { type: 'string', description: 'Nivel de presupuesto: "budget", "moderate", "luxury"' },
        hasExistingPlan: { type: 'boolean', description: 'Si es true, genera un esquema simplificado (skeleton). Usalo si el viaje ya tiene segmentos definidos.' },
        segmentCity: { type: 'string', description: 'Si se especifica, regenera solo el segmento de esta ciudad (modo segment).' },
      },
      required: ['destinations'],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      try {
        console.log('[PLANNER AGENT] generate_itinerary called with:', params);

        const { data, error } = await supabase.functions.invoke('travel-itinerary', {
          body: {
            destinations: params.destinations,
            startDate: params.startDate,
            endDate: params.endDate,
            days: params.days,
            travelers: {
              adults: params.adults || 1,
              children: params.children || 0,
            },
            interests: params.interests,
            pace: params.pace || 'moderate',
            budgetLevel: params.budgetLevel,
            generationMode: params.segmentCity ? 'segment' : params.hasExistingPlan ? 'skeleton' : 'full',
            ...(params.segmentCity && { targetSegmentCity: params.segmentCity }),
          },
        });

        if (error) {
          console.error('[PLANNER AGENT] travel-itinerary error:', error);
          return { success: false, error: `Error generando itinerario: ${error.message}` };
        }

        if (!data?.success) {
          return { success: false, error: data?.error || 'Error generando itinerario' };
        }

        const plannerData = data.data;
        const segments = plannerData?.segments || [];

        interface RawItinerarySegment { city?: string; nights?: number; highlights?: string[]; days?: RawItineraryDay[] }
        interface RawItineraryDay { morning?: RawItineraryActivity[]; afternoon?: RawItineraryActivity[]; evening?: RawItineraryActivity[] }
        interface RawItineraryActivity { title?: string; description?: string; category?: string; activityType?: string }
        interface RecommendedPlace {
          name: string;
          description?: string;
          category: string;
          suggestedSlot: 'morning' | 'afternoon' | 'evening';
          segmentCity: string;
        }

        const summary = (segments as RawItinerarySegment[]).map((seg) => ({
          city: seg.city,
          nights: seg.nights || 0,
          highlights: seg.highlights || [],
          dayCount: seg.days?.length || 0,
        }));

        // Extract recommendedPlaces from itinerary activities
        const seenNames = new Set<string>();
        const recommendedPlaces: RecommendedPlace[] = [];
        const slots: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];

        for (const seg of segments as RawItinerarySegment[]) {
          if (!seg.days || !seg.city) continue;
          for (const day of seg.days) {
            for (const slot of slots) {
              const activities = day[slot];
              if (!Array.isArray(activities)) continue;
              for (const activity of activities) {
                if (!activity.title) continue;
                if (isGenericPlaceholder(activity.title)) continue;
                const normalizedName = activity.title.trim().toLowerCase();
                if (seenNames.has(normalizedName)) continue;
                seenNames.add(normalizedName);
                recommendedPlaces.push({
                  name: activity.title,
                  description: activity.description,
                  category: activity.category || activity.activityType || 'activity',
                  suggestedSlot: slot,
                  segmentCity: seg.city,
                });
              }
            }
          }
        }

        // Limit to top 8, prioritizing variety across cities and slots
        const limitedPlaces: RecommendedPlace[] = [];
        const usedCitySlot = new Set<string>();
        // First pass: one per city+slot combo for variety
        for (const place of recommendedPlaces) {
          if (limitedPlaces.length >= 8) break;
          const key = `${place.segmentCity.toLowerCase()}:${place.suggestedSlot}`;
          if (!usedCitySlot.has(key)) {
            usedCitySlot.add(key);
            limitedPlaces.push(place);
          }
        }
        // Second pass: fill remaining slots
        for (const place of recommendedPlaces) {
          if (limitedPlaces.length >= 8) break;
          if (!limitedPlaces.includes(place)) {
            limitedPlaces.push(place);
          }
        }

        console.log(`[PLANNER AGENT] Itinerary generated: ${segments.length} segments, ${limitedPlaces.length} recommended places`);

        return {
          success: true,
          data: {
            title: plannerData?.title || '',
            summary: plannerData?.summary || '',
            segments: summary,
            totalDays: plannerData?.days || (segments as RawItinerarySegment[]).reduce((sum: number, s) => sum + (s.days?.length || 0), 0),
            rawItinerary: plannerData,
            recommendedPlaces: limitedPlaces,
          },
        };
      } catch (err: unknown) {
        console.error('[PLANNER AGENT] generate_itinerary exception:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Error inesperado generando itinerario' };
      }
    },
  };
}
