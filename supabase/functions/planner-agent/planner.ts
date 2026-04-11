import { buildSystemPrompt } from "./prompts/system.ts";
import type { AgentStep, PlanResult, ToolDefinition } from "./types.ts";
import { getToolsForLLM } from "./tools/registry.ts";

interface PlannerInput {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  previousContext: Record<string, unknown> | null;
  previousSteps: AgentStep[];
  tools: ToolDefinition[];
  userContext?: { currentCity: string; country?: string; timezone?: string } | null;
  plannerState?: Record<string, unknown> | null;
  userPreferences?: { budgetLevel?: string; pace?: string; travelers?: { adults: number; children: number; infants: number } } | null;
  userLanguage?: 'es' | 'en' | 'pt';
}

function buildPreviousStepsMessages(steps: AgentStep[]): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];

  for (const step of steps) {
    if (step.toolCalls.length === 0) continue;

    // Assistant message with tool_calls
    messages.push({
      role: 'assistant',
      content: step.thought || null,
      tool_calls: step.toolCalls.map((tc, i) => ({
        id: `call_${step.iteration}_${i}`,
        type: 'function',
        function: {
          name: tc.tool,
          arguments: JSON.stringify(tc.params),
        }
      }))
    });

    // Tool result messages
    for (let i = 0; i < step.results.length; i++) {
      const result = step.results[i];
      messages.push({
        role: 'tool',
        tool_call_id: `call_${step.iteration}_${i}`,
        content: JSON.stringify(result.result),
      });
    }
  }

  return messages;
}

export async function planNextAction(input: PlannerInput): Promise<PlanResult> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

  const currentDate = new Date().toISOString().split('T')[0];
  const systemPrompt = buildSystemPrompt(
    currentDate,
    input.plannerState as any,
    input.userPreferences,
    input.previousContext,
    input.userLanguage,
  );

  // Build messages array
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history (last 20 messages for richer context)
  const recentHistory = input.conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // User context hints are now in the system prompt via plannerState/previousContext
  let userContent = input.userMessage;
  if (input.userContext?.currentCity) {
    userContent = `[Ubicación del usuario: ${input.userContext.currentCity}, ${input.userContext.country || ''}]\n\n${userContent}`;
  }

  // Siempre agregamos el mensaje del usuario actual: conversationHistory (viene del
  // frontend) NO lo incluye porque se captura antes de la optimistic update de React.
  // Tiene que ir ANTES de previousSteps para que el orden sea user -> assistant(tool_call) -> tool_result.
  messages.push({ role: 'user', content: userContent });

  // Add previous steps as tool_calls + tool results (after the user message that triggered them)
  messages.push(...buildPreviousStepsMessages(input.previousSteps));

  const toolDefinitions = getToolsForLLM(input.tools);

  console.log('[PLANNER] Calling OpenAI with', messages.length, 'messages and', toolDefinitions.length, 'tools');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature: 0.1,
      max_completion_tokens: 2500,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[PLANNER] OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error('No response from OpenAI');
  }

  const finishReason = choice.finish_reason;
  const message = choice.message;

  console.log('[PLANNER] finish_reason:', finishReason);

  // If the model wants to call tools
  if (finishReason === 'tool_calls' || (message.tool_calls && message.tool_calls.length > 0)) {
    const toolCalls = message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    // Check if ask_user is among the tool calls
    const askUserCall = toolCalls.find((tc: { name: string; arguments: Record<string, unknown> }) => tc.name === 'ask_user');
    if (askUserCall) {
      return {
        action: 'ask_user',
        response: askUserCall.arguments.question,
        missingFields: askUserCall.arguments.missingFields || [],
        pendingAction: (askUserCall.arguments.pendingAction as string) ?? null,
        proposedData: (askUserCall.arguments.proposedData as Record<string, unknown>) ?? null,
      };
    }

    return {
      action: 'use_tools',
      toolCalls,
    };
  }

  // Model decided to respond directly
  return {
    action: 'respond',
    response: message.content || 'No pude generar una respuesta.',
  };
}
