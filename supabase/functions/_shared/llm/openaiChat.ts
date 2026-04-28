export interface OpenAiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAiChatCompletionInput {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
}

function usesMaxCompletionTokens(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

function supportsCustomTemperature(model: string): boolean {
  return !usesMaxCompletionTokens(model);
}

export async function requestOpenAiChatCompletion<T = any>(
  input: OpenAiChatCompletionInput,
): Promise<T> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    ...(usesMaxCompletionTokens(input.model)
      ? { max_completion_tokens: input.maxTokens }
      : { max_tokens: input.maxTokens }),
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
  };

  if (supportsCustomTemperature(input.model)) {
    body.temperature = input.temperature ?? 0;
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
  }

  return await openaiResponse.json() as T;
}
