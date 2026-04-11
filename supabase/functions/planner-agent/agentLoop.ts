import type { AgentContext, AgentResponse, AgentStep, ToolResult } from "./types.ts";
import { planNextAction } from "./planner.ts";
import { GUARDRAILS } from "./guardrails.ts";

export async function runAgentLoop(context: AgentContext): Promise<AgentResponse> {
  const startTime = Date.now();
  const steps: AgentStep[] = [];

  console.log('[PLANNER AGENT] Starting agent loop');
  console.log('[PLANNER AGENT] User message:', context.userMessage);

  for (let iteration = 0; iteration < GUARDRAILS.maxIterations; iteration++) {
    // Timeout check
    const elapsed = Date.now() - startTime;
    if (elapsed > GUARDRAILS.maxExecutionMs) {
      console.warn(`[PLANNER AGENT] Timeout reached at iteration ${iteration} (${elapsed}ms)`);
      return {
        response: 'La búsqueda tomó demasiado tiempo. Por favor, intenta de nuevo con una consulta más específica.',
        steps,
      };
    }

    console.log(`[PLANNER AGENT] === Iteration ${iteration + 1}/${GUARDRAILS.maxIterations} ===`);

    // Plan next action
    const plan = await planNextAction({
      userMessage: context.userMessage,
      conversationHistory: context.conversationHistory,
      previousContext: context.previousContext,
      previousSteps: steps,
      tools: context.tools,
      userContext: context.userContext,
      plannerState: context.plannerState,
      userPreferences: context.userPreferences,
      userLanguage: context.userLanguage,
    });

    console.log('[PLANNER AGENT] Plan action:', plan.action);

    // Direct response — done, but attach structuredData from previous tool results
    if (plan.action === 'respond') {
      const accumulated = extractResultsFromSteps(steps);
      if (accumulated.flightResult || accumulated.hotelResult || accumulated.packageResult || accumulated.itineraryResult) {
        const built = buildResponseFromResults(steps, accumulated.flightResult, accumulated.hotelResult, accumulated.packageResult, accumulated.itineraryResult);
        return { ...built, response: plan.response || built.response };
      }
      return {
        response: plan.response || '',
        steps,
      };
    }

    // Ask user for more info — return with needsInput flag
    if (plan.action === 'ask_user') {
      return {
        response: plan.response || 'Necesito más información para ayudarte.',
        steps,
        needsInput: true,
        missingFields: plan.missingFields,
        pendingAction: plan.pendingAction,
        proposedData: plan.proposedData,
      };
    }

    // Execute tool calls
    if (plan.action === 'use_tools' && plan.toolCalls) {
      const toolCalls = plan.toolCalls.slice(0, GUARDRAILS.maxParallelTools);

      const step: AgentStep = {
        iteration,
        thought: `Executing ${toolCalls.length} tool(s): ${toolCalls.map(tc => tc.name).join(', ')}`,
        toolCalls: toolCalls.map(tc => ({ tool: tc.name, params: tc.arguments })),
        results: [],
      };

      // Execute tools in parallel
      const toolPromises = toolCalls.map(async (tc) => {
        const tool = context.tools.find(t => t.name === tc.name);
        if (!tool) {
          return { tool: tc.name, result: { success: false, error: `Tool "${tc.name}" not found` } };
        }

        try {
          const result = await tool.execute(tc.arguments);
          return { tool: tc.name, result };
        } catch (err: unknown) {
          console.error(`[PLANNER AGENT] Tool ${tc.name} error:`, err);
          return { tool: tc.name, result: { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' } };
        }
      });

      step.results = await Promise.all(toolPromises);
      steps.push(step);

      console.log('[PLANNER AGENT] Tool results:', step.results.map(r => `${r.tool}: ${r.result.success}`));

      // Continue loop — LLM will see results and decide next action
      continue;
    }
  }

  // Max iterations reached — try to build response from whatever we have
  const accumulated = extractResultsFromSteps(steps);
  if (accumulated.flightResult || accumulated.hotelResult || accumulated.packageResult || accumulated.itineraryResult) {
    return buildResponseFromResults(steps, accumulated.flightResult, accumulated.hotelResult, accumulated.packageResult, accumulated.itineraryResult);
  }

  return {
    response: 'Se alcanzó el límite de iteraciones sin completar la búsqueda. Por favor, intenta con una solicitud más específica.',
    steps,
  };
}

function extractResultsFromSteps(steps: AgentStep[]) {
  const allResults = steps.flatMap(s => s.results);
  const getLastSuccessful = (toolName: string) => {
    for (let index = allResults.length - 1; index >= 0; index -= 1) {
      const result = allResults[index];
      if (result.tool === toolName && result.result.success) return result;
    }
    return undefined;
  };

  return {
    flightResult: getLastSuccessful('search_flights'),
    hotelResult: getLastSuccessful('search_hotels'),
    packageResult: getLastSuccessful('search_packages'),
    itineraryResult: getLastSuccessful('generate_itinerary'),
  };
}

function mapRecommendedPlaceCategory(category?: string): 'activity' | 'restaurant' | 'experience' {
  if (!category) return 'activity';
  const lower = category.toLowerCase();
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('comida')) return 'restaurant';
  if (lower.includes('experience') || lower.includes('experiencia') || lower.includes('tour')) return 'experience';
  return 'activity';
}

function buildResponseFromResults(
  steps: AgentStep[],
  flightResult?: { tool: string; result: ToolResult },
  hotelResult?: { tool: string; result: ToolResult },
  packageResult?: { tool: string; result: ToolResult },
  itineraryResult?: { tool: string; result: ToolResult },
): AgentResponse {
  const structuredData: Record<string, unknown> = {};
  const parts: string[] = [];

  const responseBlocks: string[] = [];

  if (flightResult?.result?.data) {
    const data = flightResult.result.data as Record<string, unknown>;
    structuredData.flights = data;
    const count = (data.totalFound as number) || 0;
    parts.push(`Encontré ${count} vuelo(s)`);

    const bestFlight = ((data.flights as Array<Record<string, unknown>> | undefined) || [])[0];
    if (bestFlight) {
      const airline = (bestFlight.airline as string) || 'una opción conveniente';
      const price = bestFlight.price as number | undefined;
      const currency = (bestFlight.currency as string) || 'USD';
      const stops = ((bestFlight.stops as number) || 0) === 0 ? 'directo' : `${bestFlight.stops as number} escala(s)`;
      responseBlocks.push(
        `✈️ Como mejor base te recomiendo ${airline}${price ? ` por ${price} ${currency} por persona` : ''}, ${stops}.`
      );
    }
  }
  if (hotelResult?.result?.data) {
    const data = hotelResult.result.data as Record<string, unknown>;
    structuredData.hotels = data;
    const count = (data.totalFound as number) || 0;
    parts.push(`${count} hotel(es)`);

    const bestHotel = ((data.hotels as Array<Record<string, unknown>> | undefined) || [])[0];
    if (bestHotel) {
      const name = (bestHotel.name as string) || 'una opción bien ubicada';
      const nightly = bestHotel.pricePerNight as number | undefined;
      const currency = (bestHotel.currency as string) || 'USD';
      const city = (bestHotel.city as string) || (data.searchParams as Record<string, unknown> | undefined)?.city || '';
      responseBlocks.push(
        `🏨 En ${city || 'destino'} la opción más equilibrada es ${name}${nightly ? ` desde ${nightly} ${currency}/noche` : ''}.`
      );
    }
  }
  if (packageResult?.result?.data) {
    const data = packageResult.result.data as Record<string, unknown>;
    structuredData.packages = data;
    const count = (data.totalFound as number) || 0;
    parts.push(`${count} paquete(s) turístico(s)`);
  }
  if (itineraryResult?.result?.data) {
    const data = itineraryResult.result.data as Record<string, unknown>;
    structuredData.itinerary = data;
    if (data.rawItinerary) {
      structuredData.rawItinerary = data.rawItinerary;
    }
    if (Array.isArray(data.recommendedPlaces)) {
      structuredData.recommendedPlaces = data.recommendedPlaces;
    }
    const totalDays = (data.totalDays as number) || 0;
    parts.push(`un itinerario de ${totalDays} día(s)`);

    const title = (data.title as string) || 'ruta sugerida';
    const summary = (data.summary as string) || '';
    responseBlocks.push(`🗺️ Te propongo ${title}${summary ? `: ${summary}` : ''}.`);
  }

  const suggestions = itineraryResult?.result?.data
    ? ((itineraryResult.result.data as Record<string, unknown>).recommendedPlaces as Array<Record<string, unknown>> || [])
        .slice(0, 6)
        .map(rp => ({
          label: (rp.name as string) || '',
          type: mapRecommendedPlaceCategory(rp.category as string),
          city: (rp.segmentCity as string) || '',
          slot: ((rp.suggestedSlot as string) || 'afternoon') as 'morning' | 'afternoon' | 'evening',
          description: rp.description as string | undefined,
        }))
    : undefined;

  // Generate context-aware action chips
  const actionChips: Array<{ label: string; message: string }> = [];
  if (itineraryResult && !hotelResult && !flightResult) {
    actionChips.push(
      { label: '🏨 Agregar hoteles', message: 'Buscame hoteles para todas las ciudades' },
      { label: '✈️ Buscar vuelos', message: 'Buscame vuelos desde mi ciudad' },
      { label: '🐢 Más tranquilo', message: 'Hacé el ritmo más relajado' },
    );
  } else if (hotelResult && !flightResult) {
    actionChips.push(
      { label: '💰 Más económico', message: 'Mostrá opciones más baratas' },
      { label: '⭐ Mejor categoría', message: 'Quiero algo de mayor categoría' },
      { label: '🍳 Con desayuno', message: 'Solo hoteles con desayuno incluido' },
    );
  } else if (flightResult && !hotelResult) {
    actionChips.push(
      { label: '🛫 Solo directos', message: 'Buscame solo vuelos directos' },
      { label: '💸 Más barato', message: 'Hay algo más económico?' },
      { label: '📅 Otra fecha', message: 'Mostrá vuelos para otra fecha' },
    );
  } else if (flightResult && hotelResult) {
    actionChips.push(
      { label: '📄 Armar cotización', message: 'Armá la cotización en PDF' },
      { label: '➕ Más destinos', message: 'Agregá un destino más al viaje' },
    );
  }

  const response = responseBlocks.length > 0
    ? `${responseBlocks.join('\n')}${parts.length > 0 ? `\n\nYa tengo una base útil con ${parts.join(' y ')}. Si querés, te dejo la opción más económica o la más equilibrada.` : ''}`
    : 'No encontré una opción convincente todavía. Si querés, ajusto presupuesto, fechas o tipo de viaje y te acerco algo mejor.';

  return {
    response,
    structuredData: Object.keys(structuredData).length > 0 ? structuredData : undefined,
    steps,
    ...(suggestions && suggestions.length > 0 ? { suggestions } : {}),
    ...(actionChips.length > 0 ? { actionChips } : {}),
  };
}
