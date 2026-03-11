import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ToolDefinition, ToolResult } from "../types.ts";

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
            generationMode: 'full',
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

        const summary = segments.map((seg: any) => ({
          city: seg.city,
          nights: seg.nights || 0,
          highlights: seg.highlights || [],
          dayCount: seg.days?.length || 0,
        }));

        console.log(`[PLANNER AGENT] Itinerary generated: ${segments.length} segments`);

        return {
          success: true,
          data: {
            title: plannerData?.title || '',
            summary: plannerData?.summary || '',
            segments: summary,
            totalDays: plannerData?.days || segments.reduce((sum: number, s: any) => sum + (s.days?.length || 0), 0),
            rawItinerary: plannerData,
          },
        };
      } catch (err: any) {
        console.error('[PLANNER AGENT] generate_itinerary exception:', err);
        return { success: false, error: err.message || 'Error inesperado generando itinerario' };
      }
    },
  };
}
