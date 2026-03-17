export interface AgentContext {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  previousContext: Record<string, unknown> | null;
  userContext?: { currentCity: string; country?: string; timezone?: string } | null;
  tools: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentStep {
  iteration: number;
  thought: string;
  toolCalls: Array<{ tool: string; params: Record<string, unknown> }>;
  results: Array<{ tool: string; result: ToolResult }>;
}

export interface AgentResponse {
  response: string;
  structuredData?: unknown;
  steps: AgentStep[];
  needsInput?: boolean;
  missingFields?: string[];
}

export interface PlanResult {
  action: 'respond' | 'ask_user' | 'use_tools';
  response?: string;
  missingFields?: string[];
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}
