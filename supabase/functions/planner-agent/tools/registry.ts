import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ToolDefinition } from "../types.ts";
import { createSearchFlightsTool } from "./searchFlights.ts";
import { createSearchHotelsTool } from "./searchHotels.ts";

const askUserTool: ToolDefinition = {
  name: 'ask_user',
  description: 'Pide información faltante al usuario. Usa esta herramienta cuando no tengas datos suficientes para realizar una búsqueda (ej: falta origen, destino, fechas, número de pasajeros).',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'La pregunta a hacerle al usuario' },
      missingFields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de campos que faltan (ej: ["origin", "departureDate"])'
      },
    },
    required: ['question', 'missingFields'],
  },
  execute: async (params: Record<string, unknown>) => {
    return {
      success: true,
      data: {
        question: params.question,
        missingFields: params.missingFields,
      }
    };
  }
};

export function buildToolRegistry(supabase: SupabaseClient): ToolDefinition[] {
  return [
    createSearchFlightsTool(supabase),
    createSearchHotelsTool(supabase),
    askUserTool,
  ];
}

export function getToolsForLLM(tools: ToolDefinition[]): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    }
  }));
}
