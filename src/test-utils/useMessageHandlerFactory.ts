/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';
import type { MessageRow } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '@/features/chat/types/contextState';

export const DEFAULT_CONV_ID = 'test-conv-123';

export function buildMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-default',
    conversation_id: DEFAULT_CONV_ID,
    role: 'user',
    content: { text: 'hello' },
    created_at: '2026-01-01T00:00:00Z',
    meta: null,
    client_id: null,
    status: null,
    ...overrides,
  } as MessageRow;
}

export function buildParsedRequest(overrides: Partial<ParsedTravelRequest> = {}): ParsedTravelRequest {
  return {
    requestType: 'general',
    originalMessage: 'quiero viajar',
    confidence: 0.9,
    ...overrides,
  } as ParsedTravelRequest;
}

function buildDefaultProps() {
  return {
    // Required — data props
    selectedConversation: DEFAULT_CONV_ID as string | null,
    selectedConversationRef: { current: DEFAULT_CONV_ID as string | null },
    messages: [] as MessageRow[],
    previousParsedRequest: null as ParsedTravelRequest | null,
    plannerContextRequest: null as ParsedTravelRequest | null,
    plannerState: null as any,
    // Required — callback spies
    setPreviousParsedRequest: vi.fn() as unknown as (r: ParsedTravelRequest | null) => void,
    loadContextualMemory: vi.fn().mockResolvedValue(null) as unknown as (id: string) => Promise<ParsedTravelRequest | null>,
    saveContextualMemory: vi.fn().mockResolvedValue(undefined) as unknown as (id: string, r: ParsedTravelRequest) => Promise<void>,
    clearContextualMemory: vi.fn().mockResolvedValue(undefined) as unknown as (id: string) => Promise<void>,
    loadContextState: vi.fn().mockResolvedValue(null) as unknown as (id: string) => Promise<ContextState | null>,
    saveContextState: vi.fn().mockResolvedValue(undefined) as unknown as (id: string, s: ContextState) => Promise<void>,
    updateMessageStatus: vi.fn().mockResolvedValue(undefined),
    updateConversationTitle: vi.fn().mockResolvedValue(undefined),
    handleCheaperFlightsSearch: vi.fn().mockResolvedValue(null) as unknown as (msg: string) => Promise<string | null>,
    handlePriceChangeRequest: vi.fn().mockResolvedValue(null),
    setIsLoading: vi.fn(),
    setIsTyping: vi.fn(),
    setMessage: vi.fn(),
    toast: vi.fn() as any,
    setTypingMessage: vi.fn(),
    addOptimisticMessage: vi.fn(),
    updateOptimisticMessage: vi.fn(),
    removeOptimisticMessage: vi.fn(),
    // Optional props
    persistPlannerState: undefined as any,
    setDraftPlannerFromRequest: undefined as any,
    setPlannerDraftPhase: undefined as any,
    updatePlannerState: undefined as any,
    preloadedContext: undefined as { conversationId: string; contextualMemory: ParsedTravelRequest | null; contextState: ContextState | null } | null | undefined,
    workspaceMode: undefined as 'standard' | 'planner' | undefined,
    chatMode: undefined as 'agency' | 'passenger' | undefined,
  };
}

export type UseMessageHandlerPropsObject = ReturnType<typeof buildDefaultProps>;

export function buildProps(overrides: Partial<UseMessageHandlerPropsObject> = {}): UseMessageHandlerPropsObject {
  return { ...buildDefaultProps(), ...overrides };
}
