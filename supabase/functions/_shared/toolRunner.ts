// =============================================================================
// toolRunner.ts — Generic OpenAI tool-calling loop (Phase 3.1)
// =============================================================================
//
// Authoritative spec: docs/architecture/tool-catalog-spec.md §5
//
// `runToolLoop` drives a chat-completions multi-turn dialog where the model can
// call any number of registered tools per iteration and we feed results back
// until either: (a) the model stops requesting tools, or (b) we hit the
// iteration cap, or (c) we hit the total-loop timeout.
//
// Designed to be tool-agnostic: callers provide the `tools` array and the
// `toolHandlers` map. Phase 2 will inject `save_memory_note` alongside the
// retrieval tools without touching this file.
// =============================================================================

import type { OpenAITool, ToolContext } from "./functionTools.ts";

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/** OpenAI chat-completions message entry (assistant/user/system/tool). */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  // Assistant-only when the model requested tools.
  tool_calls?: ToolCall[];
  // Tool-message-only.
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON-encoded
  };
}

export interface ChatCompletionMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: ChatCompletionMessage;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

export interface ToolCallTraceEntry {
  tool: string;
  args: unknown;
  result: unknown;
  latencyMs: number;
  error?: string;
}

export interface RunToolLoopArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  historyMessages?: ChatMessage[];
  tools: OpenAITool[];
  toolHandlers: Record<
    string,
    (args: unknown, ctx: ToolContext) => Promise<unknown>
  >;
  ctx: ToolContext;
  iterationCap?: number;
  parallelToolCalls?: boolean;
  perToolTimeoutMs?: number;
  totalLoopTimeoutMs?: number;
  /** Optional override for the OpenAI endpoint (testing only). */
  endpoint?: string;
  /** Optional fetch override for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface RunToolLoopResult {
  finalMessage: ChatCompletionMessage;
  messages: ChatMessage[];
  toolCallsTrace: ToolCallTraceEntry[];
  iterationsUsed: number;
  hitIterationCap: boolean;
  hitLoopTimeout: boolean;
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
  };
}

// -----------------------------------------------------------------------------
// Defaults (per spec §5 TOOL_LOOP_CONFIG)
// -----------------------------------------------------------------------------

const DEFAULT_ITERATION_CAP = 3;
const DEFAULT_PER_TOOL_TIMEOUT_MS = 8_000;
const DEFAULT_TOTAL_LOOP_TIMEOUT_MS = 25_000;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// Per spec anti-pattern §7.9: cap parallel fan-out at 4.
const MAX_PARALLEL_TOOL_CALLS = 4;

// -----------------------------------------------------------------------------
// OpenAI request helper (single retry on transient failure)
// -----------------------------------------------------------------------------

interface CallOpenAiArgs {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: OpenAITool[];
  parallelToolCalls: boolean;
  endpoint: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}

async function callOpenAi(args: CallOpenAiArgs): Promise<ChatCompletionResponse> {
  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    tools: args.tools,
    tool_choice: "auto",
    parallel_tool_calls: args.parallelToolCalls,
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await args.fetchImpl(args.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: args.signal,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        // Retry once on 5xx and 429; surface 4xx (except 429) immediately.
        if (resp.status >= 500 || resp.status === 429) {
          lastErr = new Error(`OpenAI ${resp.status}: ${txt}`);
          continue;
        }
        throw new Error(`OpenAI ${resp.status}: ${txt}`);
      }
      return (await resp.json()) as ChatCompletionResponse;
    } catch (err) {
      // AbortError (timeout) should not be retried.
      if ((err as { name?: string })?.name === "AbortError") throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("openai_call_failed");
}

// -----------------------------------------------------------------------------
// Tool execution helpers
// -----------------------------------------------------------------------------

interface ExecOneArgs {
  call: ToolCall;
  handlers: Record<
    string,
    (args: unknown, ctx: ToolContext) => Promise<unknown>
  >;
  ctx: ToolContext;
  perToolTimeoutMs: number;
}

async function execOne(
  args: ExecOneArgs,
): Promise<{ entry: ToolCallTraceEntry; toolMessage: ChatMessage }> {
  const startedAt = Date.now();
  const name = args.call.function.name;
  const handler = args.handlers[name];

  let parsedArgs: unknown = null;
  try {
    parsedArgs = args.call.function.arguments
      ? JSON.parse(args.call.function.arguments)
      : {};
  } catch {
    const result = {
      error: "bad_arguments",
      detail: `arguments not valid JSON: ${args.call.function.arguments?.slice(0, 200)}`,
    };
    return {
      entry: {
        tool: name,
        args: args.call.function.arguments,
        result,
        latencyMs: Date.now() - startedAt,
        error: "bad_arguments",
      },
      toolMessage: {
        role: "tool",
        tool_call_id: args.call.id,
        name,
        content: JSON.stringify(result),
      },
    };
  }

  if (!handler) {
    const result = {
      error: "unknown_tool",
      detail: `no handler registered for '${name}'`,
    };
    return {
      entry: {
        tool: name,
        args: parsedArgs,
        result,
        latencyMs: Date.now() - startedAt,
        error: "unknown_tool",
      },
      toolMessage: {
        role: "tool",
        tool_call_id: args.call.id,
        name,
        content: JSON.stringify(result),
      },
    };
  }

  let result: unknown;
  let errorTag: string | undefined;
  try {
    result = await Promise.race([
      handler(parsedArgs, args.ctx),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`tool_timeout:${name}`)),
          args.perToolTimeoutMs,
        )
      ),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("tool_timeout:")) {
      errorTag = "timeout";
      result = { error: "timeout", tool: name };
    } else {
      errorTag = "handler_error";
      result = { error: "handler_error", tool: name, detail: message };
    }
  }

  return {
    entry: {
      tool: name,
      args: parsedArgs,
      result,
      latencyMs: Date.now() - startedAt,
      error: errorTag,
    },
    toolMessage: {
      role: "tool",
      tool_call_id: args.call.id,
      name,
      content: JSON.stringify(result),
    },
  };
}

async function execBatch(
  calls: ToolCall[],
  handlers: ExecOneArgs["handlers"],
  ctx: ToolContext,
  perToolTimeoutMs: number,
  parallel: boolean,
): Promise<{ entries: ToolCallTraceEntry[]; toolMessages: ChatMessage[] }> {
  const entries: ToolCallTraceEntry[] = [];
  const toolMessages: ChatMessage[] = [];

  if (!parallel) {
    for (const call of calls) {
      const { entry, toolMessage } = await execOne({
        call,
        handlers,
        ctx,
        perToolTimeoutMs,
      });
      entries.push(entry);
      toolMessages.push(toolMessage);
    }
    return { entries, toolMessages };
  }

  // Parallel execution with a fan-out cap. Process in chunks of MAX_PARALLEL.
  for (let i = 0; i < calls.length; i += MAX_PARALLEL_TOOL_CALLS) {
    const chunk = calls.slice(i, i + MAX_PARALLEL_TOOL_CALLS);
    const results = await Promise.all(
      chunk.map((call) => execOne({ call, handlers, ctx, perToolTimeoutMs })),
    );
    for (const r of results) {
      entries.push(r.entry);
      toolMessages.push(r.toolMessage);
    }
  }
  return { entries, toolMessages };
}

// -----------------------------------------------------------------------------
// runToolLoop — the main entry point
// -----------------------------------------------------------------------------

export async function runToolLoop(args: RunToolLoopArgs): Promise<RunToolLoopResult> {
  const {
    apiKey,
    model,
    systemPrompt,
    userMessage,
    historyMessages = [],
    tools,
    toolHandlers,
    ctx,
    iterationCap = DEFAULT_ITERATION_CAP,
    parallelToolCalls = true,
    perToolTimeoutMs = DEFAULT_PER_TOOL_TIMEOUT_MS,
    totalLoopTimeoutMs = DEFAULT_TOTAL_LOOP_TIMEOUT_MS,
    endpoint = OPENAI_ENDPOINT,
    fetchImpl = fetch,
  } = args;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  const trace: ToolCallTraceEntry[] = [];
  const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };

  const loopController = new AbortController();
  const loopTimer = setTimeout(() => loopController.abort(), totalLoopTimeoutMs);
  let hitLoopTimeout = false;
  let hitIterationCap = false;
  let lastAssistant: ChatCompletionMessage = { role: "assistant", content: null };
  let iterationsUsed = 0;

  try {
    for (let iteration = 1; iteration <= iterationCap; iteration += 1) {
      iterationsUsed = iteration;

      let response: ChatCompletionResponse;
      try {
        response = await callOpenAi({
          apiKey,
          model,
          messages,
          tools,
          parallelToolCalls,
          endpoint,
          fetchImpl,
          signal: loopController.signal,
        });
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          hitLoopTimeout = true;
          break;
        }
        throw err;
      }

      // Accumulate usage.
      const usage = response.usage ?? {};
      totalUsage.promptTokens += usage.prompt_tokens ?? 0;
      totalUsage.completionTokens += usage.completion_tokens ?? 0;
      totalUsage.totalTokens += usage.total_tokens ?? 0;
      totalUsage.cachedTokens += usage.prompt_tokens_details?.cached_tokens ?? 0;

      const choice = response.choices?.[0];
      if (!choice) {
        throw new Error("openai_no_choice");
      }
      lastAssistant = choice.message;

      const toolCalls = choice.message?.tool_calls ?? [];
      // Append the assistant turn (whether it has tool calls or not).
      messages.push({
        role: "assistant",
        content: choice.message?.content ?? null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      if (toolCalls.length === 0 || choice.finish_reason !== "tool_calls") {
        // Final answer — exit cleanly.
        return {
          finalMessage: lastAssistant,
          messages,
          toolCallsTrace: trace,
          iterationsUsed,
          hitIterationCap: false,
          hitLoopTimeout: false,
          totalUsage,
        };
      }

      // Execute tool calls and append results to the message log.
      const { entries, toolMessages } = await execBatch(
        toolCalls,
        toolHandlers,
        ctx,
        perToolTimeoutMs,
        parallelToolCalls,
      );
      trace.push(...entries);
      messages.push(...toolMessages);

      if (iteration === iterationCap) {
        hitIterationCap = true;
      }
    }
  } finally {
    clearTimeout(loopTimer);
  }

  // We exited because of iteration cap or loop timeout: force a final answer
  // by asking once more without tools (so the model must reply with text).
  try {
    const finalCtl = new AbortController();
    const finalTimer = setTimeout(() => finalCtl.abort(), 5_000);
    try {
      const forced = await callOpenAi({
        apiKey,
        model,
        messages: [
          ...messages,
          {
            role: "system",
            content: hitLoopTimeout
              ? "Tiempo agotado. Responde con la mejor respuesta parcial sin llamar a más herramientas."
              : "Cap de iteraciones alcanzado. Resume lo que averiguaste y formula UNA pregunta enfocada si falta info. NO llames a más herramientas.",
          },
        ],
        tools: [],
        parallelToolCalls: false,
        endpoint,
        fetchImpl,
        signal: finalCtl.signal,
      });
      const usage = forced.usage ?? {};
      totalUsage.promptTokens += usage.prompt_tokens ?? 0;
      totalUsage.completionTokens += usage.completion_tokens ?? 0;
      totalUsage.totalTokens += usage.total_tokens ?? 0;
      totalUsage.cachedTokens += usage.prompt_tokens_details?.cached_tokens ?? 0;
      lastAssistant = forced.choices?.[0]?.message ?? lastAssistant;
      messages.push({ role: "assistant", content: lastAssistant.content ?? null });
    } finally {
      clearTimeout(finalTimer);
    }
  } catch {
    // Swallow forced-answer failures — caller will see the last assistant we have.
  }

  return {
    finalMessage: lastAssistant,
    messages,
    toolCallsTrace: trace,
    iterationsUsed,
    hitIterationCap,
    hitLoopTimeout,
    totalUsage,
  };
}
