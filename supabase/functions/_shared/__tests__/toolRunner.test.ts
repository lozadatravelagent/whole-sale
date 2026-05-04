/**
 * Unit tests for the OpenAI tool-calling loop (Phase 3.1).
 *
 * Spec: docs/architecture/tool-catalog-spec.md §5
 *
 * Validates:
 *   - returns immediately when the model's first response has no tool_calls
 *   - executes a single tool, feeds result back, exits on next answer
 *   - continues despite a failing tool (returns error in tool message)
 *   - respects iterationCap (force-final answer on overflow)
 *   - runs tool calls in parallel when configured
 *   - emits a complete trace with latency per tool
 *   - accumulates token usage across iterations
 */

import { describe, expect, it } from 'vitest';

import {
  runToolLoop,
  type ChatCompletionResponse,
} from '../toolRunner.ts';
import type { OpenAITool, ToolContext } from '../functionTools.ts';

// ---------------------------------------------------------------------------
// Helpers — scriptable fetch mock
// ---------------------------------------------------------------------------

interface ScriptedTurn {
  finish_reason: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  usage?: ChatCompletionResponse['usage'];
}

function makeScriptedFetch(turns: ScriptedTurn[]): {
  fetchImpl: typeof fetch;
  callsSeen: () => number;
} {
  let i = 0;
  const fetchImpl: typeof fetch = (_input, _init) => {
    const turn = turns[i++] ?? turns[turns.length - 1];
    const message = {
      role: 'assistant' as const,
      content: turn.content ?? null,
      tool_calls: turn.tool_calls?.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: JSON.stringify(c.args) },
      })),
    };
    const body: ChatCompletionResponse = {
      id: `cmpl-${i}`,
      model: 'gpt-4.1-test',
      choices: [{ index: 0, finish_reason: turn.finish_reason, message }],
      usage: turn.usage ?? { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fetchImpl, callsSeen: () => i };
}

const TEST_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'echo',
    description: "Echo back the input. Use when: testing. Don't use for: anything real.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { value: { type: 'string', description: 'any string' } },
      required: ['value'],
    },
  },
};

const TEST_TOOL_2: OpenAITool = {
  type: 'function',
  function: {
    name: 'double',
    description: "Double the value. Use when: testing parallel calls. Don't use for: real.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { value: { type: 'number', description: 'number' } },
      required: ['value'],
    },
  },
};

function makeCtx(): ToolContext {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: {} as any,
    conversationId: 'conv-1',
    agencyId: 'agency-1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runToolLoop — base cases', () => {
  it('returns immediately when no tool_calls are requested', async () => {
    const { fetchImpl, callsSeen } = makeScriptedFetch([
      { finish_reason: 'stop', content: 'hola sin tools' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'system',
      userMessage: 'hola',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({ ok: true }) },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(callsSeen()).toBe(1);
    expect(result.iterationsUsed).toBe(1);
    expect(result.toolCallsTrace).toHaveLength(0);
    expect(result.finalMessage.content).toBe('hola sin tools');
    expect(result.hitIterationCap).toBe(false);
  });

  it('executes a single tool then returns the next assistant answer', async () => {
    const { fetchImpl, callsSeen } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'echo', args: { value: 'ping' } }],
      },
      { finish_reason: 'stop', content: 'echoed: ping' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'sys',
      userMessage: 'say ping',
      tools: [TEST_TOOL],
      toolHandlers: {
        echo: (args: unknown) =>
          Promise.resolve({ echoed: (args as { value: string }).value }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(callsSeen()).toBe(2);
    expect(result.iterationsUsed).toBe(2);
    expect(result.toolCallsTrace).toHaveLength(1);
    expect(result.toolCallsTrace[0].tool).toBe('echo');
    expect((result.toolCallsTrace[0].result as { echoed: string }).echoed).toBe('ping');
    expect(result.finalMessage.content).toBe('echoed: ping');
  });
});

describe('runToolLoop — error handling', () => {
  it('surfaces a failing tool as { error } and continues the loop', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'echo', args: { value: 'boom' } }],
      },
      { finish_reason: 'stop', content: 'ok despite failure' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'sys',
      userMessage: 'trigger failure',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.reject(new Error('provider_down')) },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace).toHaveLength(1);
    expect(result.toolCallsTrace[0].error).toBe('handler_error');
    expect((result.toolCallsTrace[0].result as { error: string }).error).toBe('handler_error');
    expect(result.finalMessage.content).toBe('ok despite failure');
  });

  it('reports unknown_tool when handler is not registered, then continues', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'ghost_tool', args: {} }],
      },
      { finish_reason: 'stop', content: 'recovered' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({}) },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].error).toBe('unknown_tool');
    expect(result.finalMessage.content).toBe('recovered');
  });
});

describe('runToolLoop — iteration cap', () => {
  it('forces a final answer when the model loops past iterationCap', async () => {
    let i = 0;
    const fetchImpl: typeof fetch = () => {
      i += 1;
      // First two calls keep asking for tools; third (forced final) returns text.
      if (i <= 2) {
        const body: ChatCompletionResponse = {
          choices: [{
            index: 0,
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: `c${i}`,
                type: 'function',
                function: { name: 'echo', arguments: '{"value":"x"}' },
              }],
            },
          }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      const body: ChatCompletionResponse = {
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'agoté las consultas, te resumo' },
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'sys',
      userMessage: 'loop forever',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({ ok: true }) },
      ctx: makeCtx(),
      iterationCap: 2,
      fetchImpl,
    });

    expect(result.iterationsUsed).toBe(2);
    expect(result.hitIterationCap).toBe(true);
    expect(result.toolCallsTrace).toHaveLength(2);
    expect(result.finalMessage.content).toContain('agoté');
  });
});

describe('runToolLoop — parallel execution', () => {
  it('runs multiple tool calls concurrently when parallelToolCalls=true', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'echo', args: { value: 'a' } },
          { id: 'c2', name: 'double', args: { value: 21 } },
        ],
      },
      { finish_reason: 'stop', content: 'done' },
    ]);

    let echoStartedAt = 0;
    let echoFinishedAt = 0;
    let doubleStartedAt = 0;
    let doubleFinishedAt = 0;
    const startWall = Date.now();

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'sys',
      userMessage: 'go',
      tools: [TEST_TOOL, TEST_TOOL_2],
      toolHandlers: {
        echo: async (args: unknown) => {
          echoStartedAt = Date.now() - startWall;
          await new Promise((r) => setTimeout(r, 60));
          echoFinishedAt = Date.now() - startWall;
          return { echoed: (args as { value: string }).value };
        },
        double: async (args: unknown) => {
          doubleStartedAt = Date.now() - startWall;
          await new Promise((r) => setTimeout(r, 60));
          doubleFinishedAt = Date.now() - startWall;
          return { doubled: (args as { value: number }).value * 2 };
        },
      },
      ctx: makeCtx(),
      parallelToolCalls: true,
      fetchImpl,
    });

    expect(result.toolCallsTrace).toHaveLength(2);
    // Both started before either finished → real parallel execution.
    expect(echoStartedAt).toBeLessThan(doubleFinishedAt);
    expect(doubleStartedAt).toBeLessThan(echoFinishedAt);
  });
});

describe('runToolLoop — trace + usage', () => {
  it('includes latencyMs and parsed args in each trace entry', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'echo', args: { value: 'p' } }],
      },
      { finish_reason: 'stop', content: 'ok' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [TEST_TOOL],
      toolHandlers: { echo: (a: unknown) => Promise.resolve(a) },
      ctx: makeCtx(),
      fetchImpl,
    });

    const entry = result.toolCallsTrace[0];
    expect(entry).toBeTruthy();
    expect(entry.tool).toBe('echo');
    expect((entry.args as { value: string }).value).toBe('p');
    expect(entry.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('forwards `responseFormat` (Structured Outputs) on every loop call', async () => {
    // Capture every request body so we can assert response_format threads
    // through both the tool-call iteration and the final-answer call.
    const capturedBodies: Array<Record<string, unknown>> = [];
    let i = 0;
    const turns: ScriptedTurn[] = [
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'echo', args: { value: 'x' } }],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.5,"originalMessage":"u"}' },
    ];
    const fetchImpl: typeof fetch = (_input, init) => {
      const body = init?.body as string | undefined;
      if (body) capturedBodies.push(JSON.parse(body));
      const turn = turns[i++] ?? turns[turns.length - 1];
      const message = {
        role: 'assistant' as const,
        content: turn.content ?? null,
        tool_calls: turn.tool_calls?.map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: `cmpl-${i}`,
            choices: [{ index: 0, finish_reason: turn.finish_reason, message }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };

    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'test_schema',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        strict: false,
      },
    };

    await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({ ok: true }) },
      ctx: makeCtx(),
      fetchImpl,
      responseFormat,
    });

    expect(capturedBodies.length).toBeGreaterThanOrEqual(2);
    for (const b of capturedBodies) {
      expect(b.response_format).toEqual(responseFormat);
    }
  });

  it('omits `response_format` when not provided (back-compat)', async () => {
    const capturedBodies: Array<Record<string, unknown>> = [];
    const fetchImpl: typeof fetch = (_input, init) => {
      const body = init?.body as string | undefined;
      if (body) capturedBodies.push(JSON.parse(body));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'cmpl-1',
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: { role: 'assistant', content: 'ok' },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };

    await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({}) },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(capturedBodies.length).toBe(1);
    expect(capturedBodies[0]).not.toHaveProperty('response_format');
  });

  it('accumulates usage across iterations', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'echo', args: { value: 'x' } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      },
      {
        finish_reason: 'stop',
        content: 'done',
        usage: { prompt_tokens: 130, completion_tokens: 10, total_tokens: 140 },
      },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [TEST_TOOL],
      toolHandlers: { echo: () => Promise.resolve({ ok: true }) },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.totalUsage.promptTokens).toBe(230);
    expect(result.totalUsage.completionTokens).toBe(30);
    expect(result.totalUsage.totalTokens).toBe(260);
  });
});
