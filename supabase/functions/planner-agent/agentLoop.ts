import type { AgentContext, AgentResponse, AgentStep } from "./types.ts";
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
    });

    console.log('[PLANNER AGENT] Plan action:', plan.action);

    // Direct response — done
    if (plan.action === 'respond') {
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
        } catch (err: any) {
          console.error(`[PLANNER AGENT] Tool ${tc.name} error:`, err);
          return { tool: tc.name, result: { success: false, error: err.message || 'Tool execution failed' } };
        }
      });

      step.results = await Promise.all(toolPromises);
      steps.push(step);

      console.log('[PLANNER AGENT] Tool results:', step.results.map(r => `${r.tool}: ${r.result.success}`));

      // Build structured data from successful results
      const flightResult = step.results.find(r => r.tool === 'search_flights' && r.result.success);
      const hotelResult = step.results.find(r => r.tool === 'search_hotels' && r.result.success);
      const packageResult = step.results.find(r => r.tool === 'search_packages' && r.result.success);
      const itineraryResult = step.results.find(r => r.tool === 'generate_itinerary' && r.result.success);

      // If we got results and it's the last iteration, build final response
      if ((flightResult || hotelResult || packageResult || itineraryResult) && iteration === GUARDRAILS.maxIterations - 1) {
        return buildResponseFromResults(steps, flightResult, hotelResult, packageResult, itineraryResult);
      }

      // Otherwise, continue loop — LLM will see results and decide
      continue;
    }
  }

  // Max iterations reached — try to build response from whatever we have
  const lastStep = steps[steps.length - 1];
  if (lastStep) {
    const flightResult = lastStep.results.find(r => r.tool === 'search_flights' && r.result.success);
    const hotelResult = lastStep.results.find(r => r.tool === 'search_hotels' && r.result.success);
    const packageResult = lastStep.results.find(r => r.tool === 'search_packages' && r.result.success);
    const itineraryResult = lastStep.results.find(r => r.tool === 'generate_itinerary' && r.result.success);
    if (flightResult || hotelResult || packageResult || itineraryResult) {
      return buildResponseFromResults(steps, flightResult, hotelResult, packageResult, itineraryResult);
    }
  }

  return {
    response: 'Se alcanzó el límite de iteraciones sin completar la búsqueda. Por favor, intenta con una solicitud más específica.',
    steps,
  };
}

function buildResponseFromResults(
  steps: AgentStep[],
  flightResult?: { tool: string; result: any },
  hotelResult?: { tool: string; result: any },
  packageResult?: { tool: string; result: any },
  itineraryResult?: { tool: string; result: any },
): AgentResponse {
  const structuredData: Record<string, unknown> = {};
  const parts: string[] = [];

  if (flightResult?.result?.data) {
    structuredData.flights = flightResult.result.data;
    const count = flightResult.result.data.totalFound || 0;
    parts.push(`Encontré ${count} vuelo(s)`);
  }
  if (hotelResult?.result?.data) {
    structuredData.hotels = hotelResult.result.data;
    const count = hotelResult.result.data.totalFound || 0;
    parts.push(`${count} hotel(es)`);
  }
  if (packageResult?.result?.data) {
    structuredData.packages = packageResult.result.data;
    const count = packageResult.result.data.totalFound || 0;
    parts.push(`${count} paquete(s) turístico(s)`);
  }
  if (itineraryResult?.result?.data) {
    structuredData.itinerary = itineraryResult.result.data;
    const totalDays = itineraryResult.result.data.totalDays || 0;
    parts.push(`un itinerario de ${totalDays} día(s)`);
  }

  const response = parts.length > 0
    ? parts.join(' y ') + '. Aquí tienes las mejores opciones:'
    : 'No se encontraron resultados para tu búsqueda.';

  return {
    response,
    structuredData: Object.keys(structuredData).length > 0 ? structuredData : undefined,
    steps,
  };
}
