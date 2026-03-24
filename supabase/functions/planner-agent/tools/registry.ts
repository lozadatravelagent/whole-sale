import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ToolDefinition } from "../types.ts";
import { createSearchFlightsTool } from "./searchFlights.ts";
import { createSearchHotelsTool } from "./searchHotels.ts";
import { createSearchPackagesTool } from "./searchPackages.ts";
import { createGenerateItineraryTool } from "./generateItinerary.ts";
import { createResolveCityCodeTool } from "./resolveCityCode.ts";

const askUserTool: ToolDefinition = {
  name: 'ask_user',
  description: 'Pide información faltante al usuario o confirma una propuesta antes de ejecutar. Usá esta tool cuando: (1) falta info crítica que no podés inferir, (2) detectaste una región vaga y querés proponer ciudades antes de generar, (3) vas a hacer un cambio destructivo y necesitás confirmación.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Mensaje para el usuario en español. Si es propuesta de ruta, incluí ciudades con días. Si es confirmación de cambio destructivo, mencioná qué se pierde.' },
      missingFields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Campos que faltan o se necesitan confirmar: origin, dates, passengers, confirmation, destinations, budget, duration'
      },
      pendingAction: {
        type: 'string',
        description: 'Qué acción se ejecutará cuando el usuario responda: generate_itinerary, search_hotels, search_flights, modify_segment, reorder_segments'
      },
      proposedData: {
        type: 'object',
        description: 'Datos de la propuesta (para expansión regional o confirmación)',
        properties: {
          destinations: { type: 'array', items: { type: 'string' } },
          days: { type: 'array', items: { type: 'number' } },
          budget: { type: 'string' }
        },
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
        pendingAction: params.pendingAction ?? null,
        proposedData: params.proposedData ?? null,
      }
    };
  }
};

export interface AgentBudgetContext {
  userMessage: string;
  budgetLevel?: string;
}

export function buildToolRegistry(supabase: SupabaseClient, budgetContext?: AgentBudgetContext): ToolDefinition[] {
  return [
    createSearchFlightsTool(supabase),
    createSearchHotelsTool(supabase, budgetContext),
    createSearchPackagesTool(supabase),
    createGenerateItineraryTool(supabase),
    createResolveCityCodeTool(),
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
