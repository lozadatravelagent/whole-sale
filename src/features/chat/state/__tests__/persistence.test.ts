/**
 * Unit tests for EmiliaState persistence — Phase 1.3.
 *
 * Mocks `@/integrations/supabase/client` so we can assert exactly which
 * Supabase calls (table, columns, conflict target) the persistence layer
 * makes, without hitting a real database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const { mockSingle, mockSelect, mockEq, mockUpsert, mockDelete, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockUpsert = vi.fn();
  const mockDelete = vi.fn();
  const mockFrom = vi.fn();
  return { mockSingle, mockSelect, mockEq, mockUpsert, mockDelete, mockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// Import AFTER the mock so the persistence module picks it up.
import {
  EMILIA_STATE_SCHEMA_VERSION,
  deleteEmiliaState,
  loadEmiliaState,
  saveEmiliaState,
} from "../persistence";
import type { EmiliaState } from "../emiliaState";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONV_ID = "conv-emilia-1";
const AGENCY_ID = "agency-emilia-1";

function buildState(overrides?: Partial<EmiliaState>): EmiliaState {
  const base: EmiliaState = {
    profile: {
      agency_id: AGENCY_ID,
      currency: "ARS",
      language: "es",
      preferences: {},
    },
    global_memory: { notes: [] },
    session_memory: { notes: [] },
    active_refs: [],
    mode: "agency",
    trip_history: { trips: [] },
    inject_session_memories_next_turn: false,
    meta: {
      conversation_id: CONV_ID,
      agency_id: AGENCY_ID,
      schema_version: EMILIA_STATE_SCHEMA_VERSION,
      turn_count: 0,
    },
  } as EmiliaState;
  return { ...base, ...(overrides ?? {}) };
}

// ---------------------------------------------------------------------------
// Helpers to wire up the chained mock builders
// ---------------------------------------------------------------------------

function configureSelectChain(result: { data: unknown; error: unknown }) {
  mockSingle.mockResolvedValue(result);
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

function configureUpsertChain(result: { data?: unknown; error: unknown }) {
  mockUpsert.mockResolvedValue(result);
  mockFrom.mockReturnValue({ upsert: mockUpsert });
}

function configureDeleteChain(result: { error: unknown }) {
  mockEq.mockResolvedValue(result);
  mockDelete.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ delete: mockDelete });
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("loadEmiliaState", () => {
  it("returns the parsed state when a row exists", async () => {
    const state = buildState();
    configureSelectChain({
      data: {
        conversation_id: CONV_ID,
        agency_id: AGENCY_ID,
        state,
        schema_version: EMILIA_STATE_SCHEMA_VERSION,
      },
      error: null,
    });

    const result = await loadEmiliaState(CONV_ID);

    expect(mockFrom).toHaveBeenCalledWith("agent_states");
    expect(mockEq).toHaveBeenCalledWith("conversation_id", CONV_ID);
    expect(result).toEqual(state);
  });

  it("returns null on PGRST116 (no rows)", async () => {
    configureSelectChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    const result = await loadEmiliaState(CONV_ID);
    expect(result).toBeNull();
  });

  it("throws on any non-PGRST116 error", async () => {
    configureSelectChain({
      data: null,
      error: { code: "P0001", message: "boom" },
    });

    await expect(loadEmiliaState(CONV_ID)).rejects.toThrow(/boom/);
  });

  it("throws if the stored schema_version is newer than the client", async () => {
    configureSelectChain({
      data: {
        conversation_id: CONV_ID,
        agency_id: AGENCY_ID,
        state: buildState(),
        schema_version: EMILIA_STATE_SCHEMA_VERSION + 1,
      },
      error: null,
    });

    await expect(loadEmiliaState(CONV_ID)).rejects.toThrow(/schema version mismatch/i);
  });

  it("throws if conversationId is empty", async () => {
    await expect(loadEmiliaState("")).rejects.toThrow(/conversationId is required/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("saveEmiliaState", () => {
  it("UPSERTs the row keyed by conversation_id with denormalized agency_id", async () => {
    configureUpsertChain({ error: null });
    const state = buildState();

    await saveEmiliaState(state);

    expect(mockFrom).toHaveBeenCalledWith("agent_states");
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const [payload, options] = mockUpsert.mock.calls[0];
    expect(payload).toMatchObject({
      conversation_id: CONV_ID,
      agency_id: AGENCY_ID,
      schema_version: EMILIA_STATE_SCHEMA_VERSION,
      state,
    });
    expect(options).toEqual({ onConflict: "conversation_id" });
  });

  it("rejects when meta.conversation_id is missing", async () => {
    const broken = buildState();
    // @ts-expect-error — simulating malformed runtime input
    broken.meta.conversation_id = "";

    await expect(saveEmiliaState(broken)).rejects.toThrow(/conversation_id is required/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects when meta.agency_id is missing", async () => {
    const broken = buildState();
    // @ts-expect-error — simulating malformed runtime input
    broken.meta.agency_id = "";

    await expect(saveEmiliaState(broken)).rejects.toThrow(/agency_id is required/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("propagates supabase errors", async () => {
    configureUpsertChain({ error: { message: "rls violation" } });

    await expect(saveEmiliaState(buildState())).rejects.toThrow(/rls violation/);
  });
});

describe("deleteEmiliaState", () => {
  it("issues a DELETE filtered by conversation_id", async () => {
    configureDeleteChain({ error: null });

    await deleteEmiliaState(CONV_ID);

    expect(mockFrom).toHaveBeenCalledWith("agent_states");
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith("conversation_id", CONV_ID);
  });

  it("propagates supabase errors", async () => {
    configureDeleteChain({ error: { message: "fk violation" } });

    await expect(deleteEmiliaState(CONV_ID)).rejects.toThrow(/fk violation/);
  });

  it("rejects an empty conversationId", async () => {
    await expect(deleteEmiliaState("")).rejects.toThrow(/conversationId is required/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
