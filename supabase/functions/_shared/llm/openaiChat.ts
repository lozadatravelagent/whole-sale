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

export async function requestOpenAiChatCompletion<T = any>(
  input: OpenAiChatCompletionInput,
): Promise<T> {
  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0,
      max_tokens: input.maxTokens,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
  }

  return await openaiResponse.json() as T;
}
