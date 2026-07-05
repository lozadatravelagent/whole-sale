import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { executeSearch } from '../_shared/searchExecutor.ts';
import { validateParsedRequest } from '../_shared/validation.ts';
import type { ParsedRequest, SearchResults } from '../_shared/contextManagement.ts';
import { renderStateForSystemPrompt } from '../_shared/renderState.ts';
import { SCHEMA_VERSION, type EmiliaState, type PendingAction } from '../_shared/emiliaStateTypes.ts';
import { normalizeFlightRequest } from '../_shared/flightSegments.ts';
import {
  derivePendingAnswerSlots,
  normalizeApiQuoteMissingFields,
  resolveApiQuoteTurnContext,
  shouldExecuteApiQuoteSearch,
  type IterationContext,
} from './turnContextParity.ts';

type Mode = 'agency' | 'passenger';
type WorkspaceMode = 'standard' | 'planner' | 'companion';
type Language = 'es' | 'en' | 'pt';
type MessageRole = 'user' | 'assistant' | 'system';

interface ApiKeyContext {
  id: string;
  key_prefix: string;
  tenant_id: string | null;
  agency_id: string;
  created_by: string | null;
  scopes: string[];
  environment?: string | null;
  name?: string | null;
}

interface EmiliaTurnRequest {
  request_id: string;
  message: string;
  conversation_id?: string;
  lead_id?: string;
  mode?: Mode;
  workspace_mode?: WorkspaceMode;
  planner_state?: unknown;
  language?: Language;
  external_conversation_ref?: string;
  api_key_context?: ApiKeyContext;
}

interface RouteResult {
  route: 'QUOTE' | 'COLLECT' | 'PLAN';
  score: number;
  dimensions: Record<'destination' | 'dates' | 'passengers' | 'origin' | 'complexity', number>;
  missingFields: string[];
  inferredFields: string[];
  collectQuestion?: string;
  reason: string;
}

interface ConversationTurn {
  executionBranch: 'ask_minimal' | 'standard_itinerary' | 'standard_search' | 'mode_bridge' | 'proposal_chip';
  responseMode: 'proposal_first_plan' | 'show_places' | 'needs_input' | 'quote_or_search' | 'standard' | 'needs_mode_switch' | 'proposal_first_search';
  normalizedMissingFields: string[];
  messageType: 'collect_question' | 'missing_info_request' | 'trip_planner' | 'search_results' | 'no_results' | 'general_response' | 'discovery_results' | 'mode_bridge' | 'search_proposal';
  shouldUseStandardItinerary: boolean;
  shouldAskMinimalQuestion: boolean;
  uiMeta: {
    route: RouteResult['route'];
    reason: string;
    firstPlanHandledAs: 'standard_itinerary' | null;
    suggestedMode?: Mode;
  };
}

interface ContextState {
  lastSearch: {
    requestType: 'flights' | 'hotels' | 'combined';
    timestamp: string;
    flightsParams?: Record<string, unknown>;
    hotelsParams?: Record<string, unknown>;
    resultsSummary?: {
      flightsCount: number;
      hotelsCount: number;
      cheapestFlightPrice?: number;
      cheapestHotelPrice?: number;
      currency?: string;
    };
  };
  constraintsHistory: Array<Record<string, unknown>>;
  turnNumber: number;
  schemaVersion: number;
}

class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function errorResponse(error: HttpError): Response {
  return jsonResponse({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      status: error.status,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  }, error.status);
}

function assertServiceRole(req: Request) {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!expected || token !== expected) {
    throw new HttpError('UNAUTHORIZED_RUNTIME', 'emilia-turn must be invoked by the API gateway service role', 401);
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError('INVALID_REQUEST', `${field} is required`, 400);
  }
  return value.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validateRequest(body: EmiliaTurnRequest): EmiliaTurnRequest {
  const requestId = requireString(body.request_id, 'request_id');
  const requestIdOk = /^(req_[a-zA-Z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(requestId);
  if (!requestIdOk) {
    throw new HttpError('INVALID_REQUEST_ID', 'request_id must be a valid UUID or format "req_<string>"', 400);
  }

  requireString(body.message, 'message');
  if (body.conversation_id && !isUuid(body.conversation_id)) {
    throw new HttpError('INVALID_CONVERSATION_ID', 'conversation_id must be a UUID', 400);
  }
  if (body.lead_id && !isUuid(body.lead_id)) {
    throw new HttpError('INVALID_LEAD_ID', 'lead_id must be a UUID', 400);
  }
  if (body.mode && !['agency', 'passenger'].includes(body.mode)) {
    throw new HttpError('INVALID_MODE', 'mode must be agency or passenger', 400);
  }
  if (body.workspace_mode && !['standard', 'planner', 'companion'].includes(body.workspace_mode)) {
    throw new HttpError('INVALID_WORKSPACE_MODE', 'workspace_mode must be standard, planner or companion', 400);
  }
  if (body.language && !['es', 'en', 'pt'].includes(body.language)) {
    throw new HttpError('INVALID_LANGUAGE', 'language must be es, en or pt', 400);
  }
  if (!body.api_key_context?.agency_id) {
    throw new HttpError('API_KEY_MISSING_AGENCY', 'api_key_context.agency_id is required', 403);
  }
  if (!body.api_key_context.tenant_id) {
    throw new HttpError('API_KEY_MISSING_TENANT', 'api_key_context.tenant_id is required', 403);
  }
  return body;
}

function detectLanguage(message: string): Language {
  const normalized = message.toLowerCase();
  if (/\b(voo|hotel|viagem|passageiros|crianças|pra|para)\b/.test(normalized)) return 'pt';
  if (/\b(flight|hotel|trip|travelers|children|from|to)\b/.test(normalized)) return 'en';
  return 'es';
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const text = (content as Record<string, unknown>).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function normalizeMessageRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    role: row.role as MessageRole,
    content: row.content ?? { text: '' },
    meta: row.meta ?? {},
    created_at: row.created_at,
  };
}

async function resolveConversation(
  supabase: ReturnType<typeof createClient>,
  body: EmiliaTurnRequest,
  apiKey: ApiKeyContext,
  workspaceMode: WorkspaceMode,
) {
  if (body.conversation_id) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, tenant_id, agency_id, created_by, channel, external_key, workspace_mode')
      .eq('id', body.conversation_id)
      .single();

    if (error || !data) {
      throw new HttpError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }
    if (data.agency_id !== apiKey.agency_id) {
      throw new HttpError('CONVERSATION_FORBIDDEN', 'Conversation does not belong to this API key agency', 403);
    }
    if (data.tenant_id !== apiKey.tenant_id) {
      throw new HttpError('CONVERSATION_FORBIDDEN', 'Conversation does not belong to this API key tenant', 403);
    }
    if (data.workspace_mode !== workspaceMode) {
      await supabase
        .from('conversations')
        .update({ workspace_mode: workspaceMode })
        .eq('id', body.conversation_id)
        .eq('agency_id', apiKey.agency_id);
    }
    return data as Record<string, unknown>;
  }

  const externalKey = body.external_conversation_ref
    ? `api:${body.external_conversation_ref}`
    : `api:${body.request_id}`;

  if (body.external_conversation_ref) {
    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('id, tenant_id, agency_id, created_by, channel, external_key, workspace_mode')
      .eq('tenant_id', apiKey.tenant_id)
      .eq('agency_id', apiKey.agency_id)
      .eq('external_key', externalKey)
      .maybeSingle();

    if (existingError) {
      throw new HttpError('CONVERSATION_LOOKUP_FAILED', existingError.message || 'Failed to resolve API conversation', 500);
    }

    if (existing) {
      if (existing.workspace_mode !== workspaceMode) {
        await supabase
          .from('conversations')
          .update({ workspace_mode: workspaceMode })
          .eq('id', existing.id)
          .eq('agency_id', apiKey.agency_id);
      }
      return existing as Record<string, unknown>;
    }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: apiKey.tenant_id,
      agency_id: apiKey.agency_id,
      channel: 'web',
      external_key: externalKey,
      created_by: apiKey.created_by,
      workspace_mode: workspaceMode,
      state: 'active',
      last_message_at: new Date().toISOString(),
    })
    .select('id, tenant_id, agency_id, created_by, channel, external_key, workspace_mode')
    .single();

  if (error || !data) {
    throw new HttpError('CONVERSATION_CREATE_FAILED', error?.message || 'Failed to create conversation', 500);
  }

  return data as Record<string, unknown>;
}

async function insertMessage(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  role: MessageRole,
  text: string,
  meta: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content: { text },
      meta,
      client_id: crypto.randomUUID(),
    })
    .select('id, role, content, meta, created_at')
    .single();

  if (error || !data) {
    throw new HttpError('MESSAGE_INSERT_FAILED', error?.message || 'Failed to insert message', 500);
  }

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return normalizeMessageRow(data as Record<string, unknown>);
}

async function loadConversationHistory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  currentUserMessageId: string,
) {
  const { data } = await supabase
    .from('messages')
    .select('id, role, content, created_at, meta')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(16);

  return (data || [])
    .filter((row: Record<string, unknown>) => row.id !== currentUserMessageId)
    .reverse()
    .map((row: Record<string, unknown>) => ({
      role: row.role,
      content: contentText(row.content),
      timestamp: row.created_at,
    }));
}

async function loadContextState(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
): Promise<ContextState | null> {
  const { data } = await supabase
    .from('messages')
    .select('meta')
    .eq('conversation_id', conversationId)
    .eq('role', 'system')
    .contains('meta', { messageType: 'context_state' })
    .order('created_at', { ascending: false })
    .limit(1);

  const state = (data?.[0]?.meta as Record<string, unknown> | undefined)?.contextState;
  if (state && typeof state === 'object' && (state as ContextState).lastSearch) {
    return state as ContextState;
  }
  return null;
}

async function saveContextState(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  contextState: ContextState,
) {
  await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('role', 'system')
    .contains('meta', { messageType: 'context_state' });

  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'system',
      content: { text: '' },
      meta: {
        messageType: 'context_state',
        contextState,
        timestamp: new Date().toISOString(),
        source: 'api_emilia_turn',
      },
    });
}

async function loadContextualMemory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
): Promise<ParsedRequest | null> {
  const { data } = await supabase
    .from('messages')
    .select('meta')
    .eq('conversation_id', conversationId)
    .or('meta->>messageType.eq.contextual_memory,meta->>messageType.eq.missing_info_request')
    .order('created_at', { ascending: false })
    .limit(1);

  const meta = data?.[0]?.meta as Record<string, unknown> | undefined;
  const parsed = meta?.parsedRequest || meta?.originalRequest;
  if (!parsed || typeof parsed !== 'object') return null;
  return normalizeParsed(parsed as Record<string, unknown>);
}

async function saveContextualMemory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  parsedRequest: ParsedRequest,
) {
  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'system',
      content: { text: '' },
      meta: {
        messageType: 'contextual_memory',
        parsedRequest,
        timestamp: new Date().toISOString(),
        source: 'api_emilia_turn',
      },
    });
}

async function clearContextualMemory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
) {
  await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('role', 'system')
    .contains('meta', { messageType: 'contextual_memory' });
}

function contextStateToPreviousRequest(contextState: ContextState | null): Record<string, unknown> | null {
  const lastSearch = contextState?.lastSearch;
  if (!lastSearch) return null;
  return {
    requestType: lastSearch.requestType,
    confidence: 1,
    originalMessage: 'previous_search_context',
    ...(lastSearch.flightsParams ? { flights: lastSearch.flightsParams } : {}),
    ...(lastSearch.hotelsParams ? { hotels: lastSearch.hotelsParams } : {}),
  };
}

async function loadPreviousAssistantMeta(supabase: ReturnType<typeof createClient>, conversationId: string) {
  const { data } = await supabase
    .from('messages')
    .select('meta')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1);
  return (data?.[0]?.meta || null) as Record<string, unknown> | null;
}

async function countRecentCollects(supabase: ReturnType<typeof createClient>, conversationId: string): Promise<number> {
  const { data } = await supabase
    .from('messages')
    .select('meta')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(6);

  return (data || []).filter((row: Record<string, unknown>) => {
    const messageType = (row.meta as Record<string, unknown> | null)?.messageType;
    return messageType === 'collect_question' || messageType === 'missing_info_request';
  }).length;
}

async function loadOrBootstrapEmiliaState(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  apiKey: ApiKeyContext,
  mode: Mode,
  language: Language,
  leadId?: string,
  plannerState?: unknown,
): Promise<EmiliaState> {
  const { data } = await supabase
    .from('agent_states')
    .select('state')
    .eq('conversation_id', conversationId)
    .eq('agency_id', apiKey.agency_id)
    .single();

  const now = new Date().toISOString();
  let state = data?.state as EmiliaState | null;

  if (!state) {
    state = {
      profile: {
        ...(leadId ? { lead_id: leadId } : {}),
        agency_id: apiKey.agency_id,
        currency: 'USD',
        language,
        preferences: {},
      },
      global_memory: { notes: [] },
      session_memory: { notes: [] },
      active_refs: [],
      mode,
      trip_history: { trips: [] },
      inject_session_memories_next_turn: false,
      pending_action: null,
      meta: {
        conversation_id: conversationId,
        agency_id: apiKey.agency_id,
        schema_version: SCHEMA_VERSION,
        turn_count: 0,
      },
    };
  }

  state.mode = mode;
  state.profile = {
    ...state.profile,
    ...(leadId ? { lead_id: leadId } : {}),
    agency_id: apiKey.agency_id,
    language,
  };
  state.meta = {
    ...state.meta,
    conversation_id: conversationId,
    agency_id: apiKey.agency_id,
    schema_version: SCHEMA_VERSION,
  };

  if (plannerState && typeof plannerState === 'object') {
    const plannerId = String((plannerState as Record<string, unknown>).id || conversationId);
    const summary = String((plannerState as Record<string, unknown>).title || 'Active planner');
    const withoutPlanner = (state.active_refs || []).filter((ref) => ref.type !== 'plan');
    state.active_refs = [
      ...withoutPlanner,
      { type: 'plan', id: plannerId, summary1Line: summary.slice(0, 120), lastUpdated: now },
    ];
  }

  await supabase
    .from('agent_states')
    .upsert({
      conversation_id: conversationId,
      agency_id: apiKey.agency_id,
      state,
      schema_version: SCHEMA_VERSION,
    }, { onConflict: 'conversation_id' });

  return state;
}

async function saveEmiliaState(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  agencyId: string,
  state: EmiliaState,
) {
  await supabase
    .from('agent_states')
    .upsert({
      conversation_id: conversationId,
      agency_id: agencyId,
      state,
      schema_version: SCHEMA_VERSION,
    }, { onConflict: 'conversation_id' });
}

function normalizeParsed(parsed: Record<string, unknown>): ParsedRequest {
  const requestType = String(parsed.requestType || parsed.type || 'general') as ParsedRequest['type'];
  return {
    ...parsed,
    type: requestType,
    requestType,
  } as ParsedRequest;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requestTypeOf(parsed: ParsedRequest): ParsedRequest['type'] {
  return (parsed.type || (parsed as Record<string, unknown>).requestType || 'general') as ParsedRequest['type'];
}

function withRequestType(parsed: ParsedRequest, type: ParsedRequest['type']): ParsedRequest {
  return {
    ...parsed,
    type,
    requestType: type,
  } as ParsedRequest;
}

function normalizedText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function addDaysIso(date: string, days: number): string | undefined {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function totalPax(block?: Record<string, unknown>): number {
  if (!block) return 0;
  return Number(block.adults || 0) + Number(block.children || 0) + Number(block.infants || 0);
}

function normalizeSearchIntent(parsed: ParsedRequest, now = new Date()): ParsedRequest {
  const next = { ...parsed } as ParsedRequest;
  const travelerType = String((next as Record<string, unknown>).travelerType || '');

  if ((travelerType === 'couple' || travelerType === 'solo')) {
    const adults = travelerType === 'couple' ? 2 : 1;
    if (next.flights && !next.flights.adultsExplicit) {
      next.flights = { ...next.flights, adults, adultsExplicit: true };
    }
    if (next.hotels && !next.hotels.adultsExplicit) {
      next.hotels = { ...next.hotels, adults, adultsExplicit: true };
    }
  }

  if (next.hotels && !next.hotels.roomType) {
    const pax = totalPax(next.hotels);
    const roomByPax: Record<number, string> = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quadruple' };
    if (roomByPax[pax]) {
      next.hotels = { ...next.hotels, roomType: roomByPax[pax], roomTypeInferred: true };
    }
  }

  const partialStay = (next as Record<string, unknown>).partialStay as Record<string, unknown> | undefined;
  if (partialStay?.extendsBeyondHotel === true && next.flights && !next.flights.returnDate) {
    next.flights = {
      ...next.flights,
      tripType: String(partialStay.flightIntent || 'one_way'),
      tripTypeInferred: true,
    };
  }
  if (
    partialStay?.extendsBeyondHotel === true &&
    typeof partialStay.hotelNights === 'number' &&
    next.hotels?.checkinDate
  ) {
    const checkoutDate = addDaysIso(String(next.hotels.checkinDate), partialStay.hotelNights);
    if (checkoutDate && next.hotels.checkoutDate !== checkoutDate) {
      next.hotels = { ...next.hotels, checkoutDate, checkoutDateInferred: true };
    }
  }

  const fallbackStart = new Date(now.getTime());
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() + 3);
  const fallbackStartIso = fallbackStart.toISOString().slice(0, 10);

  if ((next.type === 'hotels' || next.type === 'combined') && next.hotels) {
    const hotels = { ...next.hotels };
    let touched = false;
    if (!hotels.checkinDate) {
      hotels.checkinDate = fallbackStartIso;
      hotels.checkinDateInferred = true;
      touched = true;
    }
    if (!hotels.checkoutDate && hotels.checkinDate) {
      const checkoutDate = addDaysIso(String(hotels.checkinDate), 7);
      if (checkoutDate) {
        hotels.checkoutDate = checkoutDate;
        hotels.checkoutDateInferred = true;
        touched = true;
      }
    }
    if (touched) next.hotels = hotels;
  }

  if ((next.type === 'flights' || next.type === 'combined') && next.flights) {
    const flights = { ...next.flights };
    let touched = false;
    if (!flights.departureDate) {
      flights.departureDate = fallbackStartIso;
      flights.departureDateInferred = true;
      touched = true;
    }
    const intentionalOneWay = flights.tripType === 'one_way' && partialStay?.extendsBeyondHotel === true;
    if (next.type === 'combined' && !intentionalOneWay && !flights.returnDate) {
      flights.returnDate = next.hotels?.checkoutDate || addDaysIso(String(flights.departureDate), 7);
      flights.returnDateInferred = true;
      flights.tripType = 'round_trip';
      flights.tripTypeInferred = true;
      touched = true;
    }
    if (touched) next.flights = flights;
  }

  return next;
}

function hasQuoteIntent(parsed: ParsedRequest, message: string): boolean {
  if (typeof (parsed as Record<string, unknown>).quoteIntent === 'boolean') {
    return (parsed as Record<string, unknown>).quoteIntent === true;
  }
  return /\b(cotiz\w*|precio|presupuesto|valor|cuanto\s*(sale|cuesta)|tarifa|busca(me)?|dame\s*(un\s*)?(vuelo|hotel|pasaje))\b/i.test(message);
}

function hasPlanIntent(parsed: ParsedRequest, message: string): boolean {
  if (typeof (parsed as Record<string, unknown>).planIntent === 'boolean') {
    return (parsed as Record<string, unknown>).planIntent === true;
  }
  return /\b(arma(me)?|planifica|itinerario|recorrido|ruta|circuito|viaje\s+por)\b/i.test(message);
}

function isCommercialSearchIntent(parsed: ParsedRequest): boolean {
  const commercialIntent = (parsed as Record<string, unknown>).commercialIntent as Record<string, unknown> | undefined;
  const kind = commercialIntent?.kind;
  return Boolean(kind && kind !== 'trip_planning' && kind !== 'contradiction_detected');
}

function getFirstDestination(parsed: ParsedRequest): string | undefined {
  const itineraryDestinations = parsed.itinerary?.destinations;
  const searchSeeds = (parsed as Record<string, unknown>).searchSeeds as Record<string, unknown> | undefined;
  return parsed.flights?.destination ||
    parsed.hotels?.city ||
    (Array.isArray(itineraryDestinations) ? itineraryDestinations.find((value) => typeof value === 'string' && value.trim()) : undefined) ||
    (typeof searchSeeds?.destination === 'string' ? searchSeeds.destination : undefined);
}

function coerceQuoteIntentRequest(parsed: ParsedRequest, message: string): ParsedRequest {
  const normalizedMessage = normalizedText(message);
  const explicitQuote = hasQuoteIntent(parsed, normalizedMessage) || isCommercialSearchIntent(parsed);
  if (!explicitQuote) return parsed;
  if (['flights', 'hotels', 'combined'].includes(requestTypeOf(parsed))) return parsed;

  const destination = getFirstDestination(parsed);
  if (!destination) return parsed;

  const mentionsFlight = /\b(vuelo|vuelos|aereo|aereo|pasaje|flight|flights)\b/i.test(normalizedMessage);
  const mentionsHotel = /\b(hotel|hoteles|alojamiento|hospedaje)\b/i.test(normalizedMessage);
  const wantsBoth = (mentionsFlight && mentionsHotel) || /\b(viaje|paquete|todo)\b/i.test(normalizedMessage);
  const targetType: ParsedRequest['type'] = wantsBoth ? 'combined' : mentionsHotel ? 'hotels' : 'flights';
  const travelers = parsed.itinerary?.travelers || ((parsed as Record<string, unknown>).searchSeeds as Record<string, unknown> | undefined) || {};
  const adults = Number(parsed.flights?.adults || parsed.hotels?.adults || travelers.adults || 1);
  const children = Number(parsed.flights?.children ?? parsed.hotels?.children ?? travelers.children ?? 0);
  const infants = Number(parsed.flights?.infants ?? parsed.hotels?.infants ?? travelers.infants ?? 0);
  const startDate = parsed.flights?.departureDate || parsed.hotels?.checkinDate || parsed.itinerary?.startDate;
  const endDate = parsed.flights?.returnDate || parsed.hotels?.checkoutDate || parsed.itinerary?.endDate ||
    (startDate && parsed.itinerary?.days ? addDaysIso(String(startDate), Number(parsed.itinerary.days)) : undefined);

  return {
    ...parsed,
    type: targetType,
    requestType: targetType,
    ...(targetType === 'flights' || targetType === 'combined'
      ? {
          flights: {
            ...(parsed.flights || {}),
            destination: parsed.flights?.destination || destination,
            ...(startDate ? { departureDate: startDate } : {}),
            ...(endDate ? { returnDate: endDate, tripType: 'round_trip' } : {}),
            adults,
            adultsExplicit: true,
            children,
            infants,
          },
        }
      : {}),
    ...(targetType === 'hotels' || targetType === 'combined'
      ? {
          hotels: {
            ...(parsed.hotels || {}),
            city: parsed.hotels?.city || destination,
            ...(startDate ? { checkinDate: startDate } : {}),
            ...(endDate ? { checkoutDate: endDate } : {}),
            adults,
            adultsExplicit: true,
            children,
            infants,
          },
        }
      : {}),
  } as ParsedRequest;
}

function shouldPersistIntent(parsed: ParsedRequest | null | undefined): boolean {
  if (!parsed) return false;
  const type = requestTypeOf(parsed);
  switch (type) {
    case 'general':
      return false;
    case 'missing_info_request':
      return true;
    case 'flights':
      return Boolean(parsed.flights?.destination || parsed.flights?.origin);
    case 'hotels':
      return Boolean(parsed.hotels?.city);
    case 'combined':
      return Boolean(parsed.flights?.destination || parsed.hotels?.city);
    case 'itinerary':
      return Array.isArray(parsed.itinerary?.destinations) && parsed.itinerary.destinations.length > 0;
    case 'services':
    case 'packages':
    case 'activities':
    case 'transfers':
      return true;
    default:
      return false;
  }
}

async function persistTurnIntentSnapshot(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  parsed: ParsedRequest | null | undefined,
) {
  if (!conversationId || !shouldPersistIntent(parsed)) return false;
  await saveContextualMemory(supabase, conversationId, parsed!);
  return true;
}

function buildFailedValidationContextState(
  parsedRequest: ParsedRequest,
  previousState: ContextState | null,
): ContextState | null {
  const type = requestTypeOf(parsedRequest);
  if (!['flights', 'hotels', 'combined'].includes(type)) return null;

  const normalizedFlight = parsedRequest.flights ? normalizeFlightRequest(parsedRequest.flights) : null;
  return {
    lastSearch: {
      requestType: type as 'flights' | 'hotels' | 'combined',
      timestamp: new Date().toISOString(),
      ...(normalizedFlight ? {
        flightsParams: {
          origin: normalizedFlight.origin || '',
          destination: normalizedFlight.destination || '',
          departureDate: normalizedFlight.departureDate || '',
          returnDate: normalizedFlight.returnDate,
          tripType: normalizedFlight.tripType,
          segments: normalizedFlight.segments,
          adults: normalizedFlight.adults || 0,
          children: normalizedFlight.children || 0,
          infants: normalizedFlight.infants || 0,
          stops: normalizedFlight.stops,
          luggage: normalizedFlight.luggage,
          preferredAirline: normalizedFlight.preferredAirline,
          maxLayoverHours: normalizedFlight.maxLayoverHours,
        },
      } : {}),
      ...(parsedRequest.hotels ? {
        hotelsParams: {
          city: parsedRequest.hotels.city || '',
          checkinDate: parsedRequest.hotels.checkinDate || '',
          checkoutDate: parsedRequest.hotels.checkoutDate || '',
          adults: parsedRequest.hotels.adults || 0,
          children: parsedRequest.hotels.children || 0,
          infants: parsedRequest.hotels.infants || 0,
          roomType: parsedRequest.hotels.roomType,
          mealPlan: parsedRequest.hotels.mealPlan,
          hotelChains: parsedRequest.hotels.hotelChains,
          hotelName: parsedRequest.hotels.hotelName,
        },
      } : {}),
      resultsSummary: {
        flightsCount: previousState?.lastSearch?.resultsSummary?.flightsCount ?? 0,
        hotelsCount: previousState?.lastSearch?.resultsSummary?.hotelsCount ?? 0,
      },
    },
    constraintsHistory: previousState?.constraintsHistory || [],
    turnNumber: (previousState?.turnNumber || 0) + 1,
    schemaVersion: 1,
  };
}

function buildCollectQuestion(fields: string[], parsedRequest: ParsedRequest, validationMessage?: string): string {
  const normalized = [...new Set(fields.map(normalizeMissingField))];
  if (normalized.length === 0) {
    return validationMessage || parsedRequest.message || 'Necesito un dato mas para avanzar.';
  }

  const hasOrigin = normalized.includes('origin');
  const hasDates = normalized.includes('dates');
  const hasDestination = normalized.includes('destination');
  const hasPassengers = normalized.includes('passengers');
  const hasDuration = normalized.includes('duration');

  if (hasOrigin && hasDates) return '¿Desde qué ciudad quiere salir el pasajero/a y para qué fechas exactas?';
  if (hasDestination && hasDates) return '¿A qué destino quiere viajar y para qué fechas exactas?';
  if (hasOrigin) return '¿Desde qué ciudad quiere salir el pasajero/a?';
  if (hasDestination) return '¿A qué destino desea viajar el pasajero/a?';
  if (hasDates) return '¿Para qué fechas exactas quiere viajar?';
  if (hasDuration) return '¿Cuántos días durará el viaje?';
  if (hasPassengers) return '¿Cuántas personas viajan?';
  return validationMessage || parsedRequest.message || 'Necesito un dato mas para avanzar.';
}

function mergeDefined<T extends Record<string, unknown>>(base: T | undefined | null, overlay: T | undefined | null): T | undefined {
  if (!base && !overlay) return undefined;
  const out: Record<string, unknown> = { ...(base || {}) };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out as T;
}

function destinationsDiffer(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizedText(a).trim() !== normalizedText(b).trim();
}

function extractDurationDays(message: string): number | null {
  const normalized = normalizedText(message);
  const numeric = /\b(\d{1,2})\s*(dias|días|noches|nights|days)\b/i.exec(normalized);
  if (numeric) return Math.max(1, Number(numeric[1]));
  if (/\b(una|un)\s+semana\b/i.test(normalized)) return 7;
  if (/\bdos\s+semanas\b/i.test(normalized)) return 14;
  return null;
}

function applyDurationToSearch(parsed: ParsedRequest, message: string): ParsedRequest {
  const days = extractDurationDays(message);
  if (!days) return parsed;
  const next = { ...parsed } as ParsedRequest;

  if (next.flights?.departureDate) {
    const returnDate = addDaysIso(String(next.flights.departureDate), days);
    if (returnDate) {
      next.flights = { ...next.flights, returnDate, tripType: 'round_trip' };
    }
  }
  if (next.hotels?.checkinDate) {
    const checkoutDate = addDaysIso(String(next.hotels.checkinDate), days);
    if (checkoutDate) {
      next.hotels = { ...next.hotels, checkoutDate };
    }
  }
  return next;
}

function explicitlyNewIndependent(parsed: ParsedRequest): boolean {
  const iteration = (parsed as Record<string, unknown>).iterationIntent as Record<string, unknown> | undefined;
  const continuity = (parsed as Record<string, unknown>).turnContinuity as Record<string, unknown> | undefined;
  return iteration?.type === 'unrelated' || continuity?.relation === 'new_independent_request';
}

function hasContinuitySignal(parsed: ParsedRequest, message: string): boolean {
  const iteration = (parsed as Record<string, unknown>).iterationIntent as Record<string, unknown> | undefined;
  const continuity = (parsed as Record<string, unknown>).turnContinuity as Record<string, unknown> | undefined;
  if (iteration?.isIteration === true) return true;
  if (
    continuity &&
    continuity.relation !== 'new_independent_request' &&
    (continuity.target === 'last_search' || continuity.target === 'pending_action' || continuity.target === 'unknown')
  ) {
    return true;
  }
  return /\b(mism[ao]s?|esas?\s+fechas?|esos?\s+vuelos?|agrega(?:r|me)?\s+hotel|sum(?:a|ar)\s+hotel|una\s+semana|\d{1,2}\s*(dias|días|noches)|desde\s+)\b/i.test(message);
}

function mergeWithPersistentSearchContext(
  parsedRequest: ParsedRequest,
  persistentState: ContextState | null,
  message: string,
): ParsedRequest {
  const lastSearch = persistentState?.lastSearch;
  if (!lastSearch || explicitlyNewIndependent(parsedRequest)) return parsedRequest;

  const previousDestination = lastSearch.flightsParams?.destination || lastSearch.hotelsParams?.city;
  const currentDestination = getFirstDestination(parsedRequest);
  const continuity = hasContinuitySignal(parsedRequest, message);
  if (destinationsDiffer(currentDestination, previousDestination) && !continuity) {
    return parsedRequest;
  }

  const parsedType = requestTypeOf(parsedRequest);
  if (
    !continuity &&
    !['missing_info_request', 'flights', 'hotels', 'combined'].includes(parsedType)
  ) {
    return parsedRequest;
  }

  const merged = { ...parsedRequest } as ParsedRequest;
  const wantsHotel = /\b(hotel|hoteles|alojamiento|hospedaje)\b/i.test(normalizedText(message)) || Boolean(parsedRequest.hotels);
  const wantsFlight = /\b(vuelo|vuelos|aereo|pasaje|flight|flights)\b/i.test(normalizedText(message)) || Boolean(parsedRequest.flights);

  if (lastSearch.flightsParams && (parsedType !== 'hotels' || wantsFlight || lastSearch.requestType === 'combined')) {
    merged.flights = mergeDefined(lastSearch.flightsParams as Record<string, unknown>, parsedRequest.flights as Record<string, unknown>) as Record<string, unknown>;
  }

  if (lastSearch.hotelsParams && (parsedType !== 'flights' || wantsHotel || lastSearch.requestType === 'combined')) {
    merged.hotels = mergeDefined(lastSearch.hotelsParams as Record<string, unknown>, parsedRequest.hotels as Record<string, unknown>) as Record<string, unknown>;
  }

  if (wantsHotel && !merged.hotels && lastSearch.flightsParams) {
    merged.hotels = {
      city: lastSearch.flightsParams.destination,
      checkinDate: lastSearch.flightsParams.departureDate,
      checkoutDate: lastSearch.flightsParams.returnDate || addDaysIso(String(lastSearch.flightsParams.departureDate || ''), 7),
      adults: lastSearch.flightsParams.adults || 1,
      adultsExplicit: true,
      children: lastSearch.flightsParams.children || 0,
      infants: lastSearch.flightsParams.infants || 0,
    };
  }

  if (wantsFlight && !merged.flights && lastSearch.hotelsParams) {
    merged.flights = {
      destination: lastSearch.hotelsParams.city,
      departureDate: lastSearch.hotelsParams.checkinDate,
      returnDate: lastSearch.hotelsParams.checkoutDate,
      adults: lastSearch.hotelsParams.adults || 1,
      adultsExplicit: true,
      children: lastSearch.hotelsParams.children || 0,
      infants: lastSearch.hotelsParams.infants || 0,
      tripType: 'round_trip',
    };
  }

  if (merged.flights && merged.hotels) {
    merged.type = 'combined';
    (merged as Record<string, unknown>).requestType = 'combined';
  } else if (merged.flights) {
    merged.type = 'flights';
    (merged as Record<string, unknown>).requestType = 'flights';
  } else if (merged.hotels) {
    merged.type = 'hotels';
    (merged as Record<string, unknown>).requestType = 'hotels';
  }

  return applyDurationToSearch(merged, message);
}

function resolveTurnIntentFromSearchContext(
  parsedRequest: ParsedRequest,
  persistentState: ContextState | null,
  message: string,
): ParsedRequest {
  const normalized = normalizedText(message);
  const wantsHotel = /\b(hotel|hoteles|alojamiento|hospedaje)\b/i.test(normalized);
  const wantsFlight = /\b(vuelo|vuelos|aereo|pasaje|flight|flights)\b/i.test(normalized);
  let next = parsedRequest;

  if (wantsHotel && !wantsFlight && persistentState?.lastSearch?.flightsParams) {
    const flight = persistentState.lastSearch.flightsParams;
    next = withRequestType({
      ...next,
      flights: undefined,
      hotels: mergeDefined({
        city: flight.destination,
        checkinDate: flight.departureDate,
        checkoutDate: flight.returnDate || addDaysIso(String(flight.departureDate || ''), 7),
        adults: flight.adults || 1,
        adultsExplicit: true,
        children: flight.children || 0,
        infants: flight.infants || 0,
      }, next.hotels as Record<string, unknown>) as Record<string, unknown>,
    } as ParsedRequest, 'hotels');
  }

  if (wantsHotel && wantsFlight && requestTypeOf(next) !== 'combined') {
    next = withRequestType({
      ...next,
      flights: next.flights || persistentState?.lastSearch?.flightsParams,
      hotels: next.hotels || persistentState?.lastSearch?.hotelsParams,
    } as ParsedRequest, 'combined');
  }

  return next;
}


function normalizeMissingField(field: string): string {
  const normalized = field
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('origin')) return 'origin';
  if (normalized.includes('destino') || normalized.includes('destination') || normalized.includes('city')) return 'destination';
  if (normalized.includes('fecha') || normalized.includes('date')) return 'dates';
  if (normalized.includes('passenger') || normalized.includes('adult') || normalized.includes('traveler') || normalized.includes('pasaj')) return 'passengers';
  if (normalized.includes('dias') || normalized.includes('duration')) return 'duration';
  return normalized.replace(/\s+/g, '_');
}

function routeRequest(parsed: ParsedRequest, validation = validateParsedRequest(parsed)): RouteResult {
  const dimensions = {
    destination: parsed.itinerary?.destinations?.length || parsed.flights?.destination || parsed.hotels?.city ? 1 : 0,
    dates: parsed.flights?.departureDate || (parsed.hotels?.checkinDate && parsed.hotels?.checkoutDate) || parsed.itinerary?.days ? 1 : 0,
    passengers: parsed.flights?.adults || parsed.hotels?.adults || parsed.itinerary?.travelers?.adults ? 1 : 0.5,
    origin: parsed.hotels || parsed.itinerary || parsed.flights?.origin ? 1 : 0,
    complexity: 1,
  };

  const score = (
    dimensions.destination * 0.30 +
    dimensions.dates * 0.25 +
    dimensions.passengers * 0.15 +
    dimensions.origin * 0.15 +
    dimensions.complexity * 0.15
  );

  const missingFields = normalizeApiQuoteMissingFields(parsed, validation.missingFields.map((f) => f.field));
  const isEffectivelyValid = validation.isValid || missingFields.length === 0;
  const message = normalizedText(parsed.originalMessage || '');
  const type = requestTypeOf(parsed);

  if ((hasQuoteIntent(parsed, message) || isCommercialSearchIntent(parsed)) && ['flights', 'hotels', 'combined'].includes(type)) {
    if (isEffectivelyValid) {
      return {
        route: 'QUOTE',
        score: Math.max(score, 0.75),
        dimensions,
        missingFields,
        inferredFields: [],
        reason: 'quote_intent_complete',
      };
    }
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields,
      inferredFields: [],
      collectQuestion: buildCollectQuestion(missingFields.length > 0 ? missingFields : (parsed.missingFields || []), parsed, validation.message),
      reason: 'quote_intent_incomplete',
    };
  }

  if (type === 'itinerary') {
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields: missingFields.length > 0 ? missingFields : ['origin'],
      inferredFields: [],
      collectQuestion: buildCollectQuestion(missingFields.length > 0 ? missingFields : ['origin'], parsed, validation.message || parsed.message),
      reason: 'api_quote_only_planner_disabled',
    };
  }

  if (type === 'missing_info_request' || !validation.isValid) {
    if (isEffectivelyValid) {
      return {
        route: 'QUOTE',
        score: Math.max(score, 0.75),
        dimensions,
        missingFields: [],
        inferredFields: [],
        reason: 'quote_intent_complete',
      };
    }
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields: missingFields.length > 0 ? missingFields : (parsed.missingFields || []),
      inferredFields: [],
      collectQuestion: buildCollectQuestion(missingFields.length > 0 ? missingFields : (parsed.missingFields || []), parsed, parsed.message || validation.message),
      reason: 'needs_clarification',
    };
  }

  if (['flights', 'hotels', 'combined', 'packages', 'services', 'activities', 'transfers'].includes(type)) {
    return {
      route: 'QUOTE',
      score: Math.max(score, 0.75),
      dimensions,
      missingFields,
      inferredFields: [],
      reason: 'quote_intent_complete',
    };
  }

  return {
    route: 'COLLECT',
    score,
    dimensions,
    missingFields: missingFields.length > 0 ? missingFields : ['destination'],
    inferredFields: [],
    collectQuestion: buildCollectQuestion(missingFields.length > 0 ? missingFields : ['destination'], parsed, parsed.message),
    reason: hasPlanIntent(parsed, message) ? 'api_quote_only_planner_disabled' : 'needs_clarification',
  };
}

function resolveConversationTurn(options: {
  parsedRequest: ParsedRequest;
  routeResult: RouteResult;
  mode: Mode;
  hasPersistentContext: boolean;
  hasPreviousParsedRequest: boolean;
  recentCollectCount: number;
  previousMessageType?: string;
  hasPendingAction?: boolean;
  iterationContext?: IterationContext;
}): ConversationTurn {
  const { parsedRequest, routeResult, mode, recentCollectCount, previousMessageType, hasPendingAction, iterationContext } = options;
  const normalizedMissingFields = [...new Set(routeResult.missingFields.map(normalizeMissingField))];
  const shouldAskMinimalQuestion = routeResult.route === 'COLLECT' && recentCollectCount < 3;
  const llmIteration = Boolean((parsedRequest as Record<string, unknown>).iterationIntent && ((parsedRequest as Record<string, unknown>).iterationIntent as Record<string, unknown>).isIteration);
  const explicitPlanIntent = parsedRequest.type === 'itinerary' && ((parsedRequest as Record<string, unknown>).planIntent === true || (parsedRequest.confidence || 0) >= 0.85);

  if (shouldAskMinimalQuestion) {
    return {
      executionBranch: 'ask_minimal',
      responseMode: 'needs_input',
      normalizedMissingFields,
      messageType: 'missing_info_request',
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: true,
      uiMeta: { route: routeResult.route, reason: routeResult.reason, firstPlanHandledAs: null },
    };
  }

  const bridgeBlocked = previousMessageType === 'mode_bridge' ||
    previousMessageType === 'quote_active_plan' ||
    Boolean(hasPendingAction) ||
    Boolean(iterationContext?.isIteration) ||
    llmIteration ||
    explicitPlanIntent;
  if (!bridgeBlocked && mode === 'agency' && routeResult.route === 'PLAN') {
    return {
      executionBranch: 'mode_bridge',
      responseMode: 'needs_mode_switch',
      normalizedMissingFields,
      messageType: 'mode_bridge',
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: false,
      uiMeta: { route: routeResult.route, reason: routeResult.reason, firstPlanHandledAs: null, suggestedMode: 'passenger' },
    };
  }
  if (!bridgeBlocked && mode === 'passenger' && routeResult.route === 'QUOTE' && ['flights', 'hotels', 'combined'].includes(parsedRequest.type)) {
    return {
      executionBranch: 'mode_bridge',
      responseMode: 'needs_mode_switch',
      normalizedMissingFields,
      messageType: 'mode_bridge',
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: false,
      uiMeta: { route: routeResult.route, reason: routeResult.reason, firstPlanHandledAs: null, suggestedMode: 'agency' },
    };
  }

  if (mode === 'passenger') {
    return {
      executionBranch: 'standard_itinerary',
      responseMode: 'proposal_first_plan',
      normalizedMissingFields,
      messageType: 'trip_planner',
      shouldUseStandardItinerary: true,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: routeResult.route === 'PLAN' ? 'standard_itinerary' : null,
      },
    };
  }

  return {
    executionBranch: 'standard_search',
    responseMode: routeResult.route === 'QUOTE' ? 'quote_or_search' : 'standard',
    normalizedMissingFields,
    messageType: parsedRequest.type === 'general' ? 'general_response' : 'search_results',
    shouldUseStandardItinerary: false,
    shouldAskMinimalQuestion: false,
    uiMeta: { route: routeResult.route, reason: routeResult.reason, firstPlanHandledAs: null },
  };
}

function buildPendingAction(
  routeResult: RouteResult,
  parsedRequest: ParsedRequest,
  appliedSlots?: Record<string, unknown>,
): PendingAction | null {
  const fields = routeResult.missingFields.map(normalizeMissingField).filter(Boolean);
  if (fields.length === 0) return null;
  const type = requestTypeOf(parsedRequest);
  const applied = appliedSlots && Object.keys(appliedSlots).length > 0
    ? appliedSlots
    : undefined;
  return {
    kind: 'awaiting_user_input',
    for: type === 'itinerary'
      ? 'itinerary_completion'
      : type === 'flights'
        ? 'flight_completion'
        : type === 'hotels'
          ? 'hotel_completion'
        : 'quote_completion',
    fields,
    prompt: (routeResult.collectQuestion || parsedRequest.message || 'Necesito un dato mas para avanzar.').slice(0, 240),
    issuedAt: new Date().toISOString(),
    ...(applied ? { applied, complete: false } : {}),
  };
}

function buildAssistantText(args: {
  parsedRequest: ParsedRequest;
  routeResult: RouteResult;
  conversationTurn: ConversationTurn;
  searchResults?: SearchResults | null;
  language: Language;
}): string {
  const { parsedRequest, routeResult, conversationTurn, searchResults, language } = args;
  if (conversationTurn.messageType === 'mode_bridge') {
    return conversationTurn.uiMeta.suggestedMode === 'passenger'
      ? 'Para armar el itinerario completo, conviene seguir en modo pasajero.'
      : 'Para cotizar vuelos u hoteles, conviene seguir en modo agencia.';
  }
  if (conversationTurn.responseMode === 'needs_input') {
    return routeResult.collectQuestion || parsedRequest.message || 'Necesito un dato mas para avanzar.';
  }
  if (conversationTurn.messageType === 'trip_planner') {
    return language === 'en'
      ? 'I prepared the itinerary with the available trip structure.'
      : language === 'pt'
        ? 'Preparei o itinerario com a estrutura disponivel.'
        : 'Arme el itinerario con la estructura disponible.';
  }
  if (conversationTurn.messageType === 'no_results') {
    return language === 'en'
      ? 'I could not find results for this search. Try changing dates, destination, or hotel filters.'
      : language === 'pt'
        ? 'Nao encontrei resultados para esta busca. Tente alterar datas, destino ou filtros de hotel.'
        : 'No encontre resultados para esta busqueda. Proba cambiando fechas, destino o filtros de hotel.';
  }

  const flightsCount = searchResults?.flights?.count ?? 0;
  const hotelsCount = searchResults?.hotels?.count ?? 0;
  const partialHotelError = (searchResults?.metadata as Record<string, any> | undefined)?.partial_errors?.hotels ||
    (searchResults?.hotels as any)?.error;
  if (searchResults?.status === 'incomplete' && flightsCount > 0 && hotelsCount === 0 && partialHotelError) {
    return language === 'en'
      ? `I found ${flightsCount} flight options, but the hotel search did not complete. Try again or reduce the hotel filters.`
      : language === 'pt'
        ? `Encontrei ${flightsCount} opcoes de voo, mas a busca de hoteis nao foi concluida. Tente novamente ou reduza os filtros de hotel.`
        : `Encontre ${flightsCount} opciones de vuelo, pero la busqueda de hoteles no se completo. Proba nuevamente o reduci los filtros de hotel.`;
  }
  if (flightsCount > 0 && hotelsCount > 0) return `Encontre ${flightsCount} opciones de vuelo y ${hotelsCount} hoteles para esta busqueda.`;
  if (flightsCount > 0) return `Encontre ${flightsCount} opciones de vuelo para esta busqueda.`;
  if (hotelsCount > 0) return `Encontre ${hotelsCount} hoteles para esta busqueda.`;
  return 'Procese la solicitud y deje el resultado guardado en la conversacion.';
}

function hasAnySearchResults(searchResults?: SearchResults | null): boolean {
  return (searchResults?.flights?.count ?? 0) > 0 ||
    (searchResults?.hotels?.count ?? 0) > 0 ||
    (searchResults?.packages?.count ?? 0) > 0 ||
    (searchResults?.services?.count ?? 0) > 0 ||
    (searchResults?.activities?.count ?? 0) > 0 ||
    (searchResults?.transfers?.count ?? 0) > 0 ||
    Boolean(searchResults?.itinerary);
}

function isNoResultsSearch(searchResults?: SearchResults | null): boolean {
  return Boolean(searchResults && searchResults.status === 'completed' && !hasAnySearchResults(searchResults));
}

function buildContextState(
  parsedRequest: ParsedRequest,
  searchResults: SearchResults,
  previousState: ContextState | null,
): ContextState | null {
  if (!['flights', 'hotels', 'combined'].includes(parsedRequest.type)) return null;

  return {
    lastSearch: {
      requestType: parsedRequest.type as 'flights' | 'hotels' | 'combined',
      timestamp: new Date().toISOString(),
      ...(parsedRequest.flights ? { flightsParams: parsedRequest.flights } : {}),
      ...(parsedRequest.hotels ? { hotelsParams: parsedRequest.hotels } : {}),
      resultsSummary: {
        flightsCount: searchResults.flights?.count ?? 0,
        hotelsCount: searchResults.hotels?.count ?? 0,
      },
    },
    constraintsHistory: previousState?.constraintsHistory || [],
    turnNumber: (previousState?.turnNumber || 0) + 1,
    schemaVersion: 1,
  };
}

function buildCombinedData(parsedRequest: ParsedRequest, searchResults: SearchResults) {
  const flights = searchResults.flights?.items || [];
  const hotels = searchResults.hotels?.items || [];
  if (flights.length === 0 && hotels.length === 0) return undefined;
  return {
    requestType: parsedRequest.type === 'combined'
      ? 'combined'
      : flights.length > 0 ? 'flights-only' : 'hotels-only',
    flights,
    hotels,
  };
}

function buildPlannerData(searchResults?: SearchResults | null): unknown {
  if (!searchResults?.itinerary) return undefined;
  return searchResults.itinerary;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    assertServiceRole(req);
    if (req.method !== 'POST') {
      throw new HttpError('METHOD_NOT_ALLOWED', 'Only POST is allowed', 405);
    }

    const body = validateRequest(await req.json() as EmiliaTurnRequest);
    const apiKey = body.api_key_context!;
    const requestedMode = body.mode || 'agency';
    const requestedWorkspaceMode = body.workspace_mode || 'standard';
    const mode: Mode = 'agency';
    const workspaceMode: WorkspaceMode = 'standard';
    const language = body.language || detectLanguage(body.message);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const conversation = await resolveConversation(supabase, body, apiKey, workspaceMode);
    const conversationId = String(conversation.id);

    const userMessage = await insertMessage(supabase, conversationId, 'user', body.message, {
      status: 'sent',
      source: 'api_emilia_turn',
      request_id: body.request_id,
      api_key_id: apiKey.id,
      api_key_prefix: apiKey.key_prefix,
      mode,
      workspace_mode: workspaceMode,
      requested_mode: requestedMode,
      requested_workspace_mode: requestedWorkspaceMode,
      language,
      external_conversation_ref: body.external_conversation_ref || null,
    });

    const conversationHistoryPromise = loadConversationHistory(supabase, conversationId, userMessage.id);
    const [contextualMemory, persistentState, previousAssistantMeta, conversationHistory] = await Promise.all([
      loadContextualMemory(supabase, conversationId),
      loadContextState(supabase, conversationId),
      loadPreviousAssistantMeta(supabase, conversationId),
      conversationHistoryPromise,
    ]);

    let emiliaState = await loadOrBootstrapEmiliaState(
      supabase,
      conversationId,
      apiKey,
      mode,
      language,
      body.lead_id,
      undefined,
    );
    const memoryStateBlock = renderStateForSystemPrompt(emiliaState);
    const previousSearchContext = contextStateToPreviousRequest(persistentState);
    const previousContext = conversationHistory.length === 0
      ? null
      : (contextualMemory || previousSearchContext);

    const parseStartedAt = Date.now();
    const parserResponse = await supabase.functions.invoke('ai-message-parser', {
      body: {
        message: body.message,
        language,
        currentDate: new Date().toISOString().slice(0, 10),
        previousContext,
        conversationHistory,
        plannerContext: null,
        historyWindow: 15,
        contextMeta: {
          conversationId,
          agencyId: apiKey.agency_id,
          leadId: body.lead_id,
          messageId: userMessage.id,
        },
        memoryStateBlock,
        emiliaState,
      },
    });
    const parseTimeMs = Date.now() - parseStartedAt;

    if (parserResponse.error || !parserResponse.data?.success) {
      throw new HttpError('AI_PARSE_ERROR', parserResponse.error?.message || parserResponse.data?.error || 'AI parser failed', 502);
    }

    let parsedRequest = normalizeParsed(parserResponse.data.parsed || {});
    parsedRequest = coerceQuoteIntentRequest(parsedRequest, body.message);

    emiliaState = await loadOrBootstrapEmiliaState(
      supabase,
      conversationId,
      apiKey,
      mode,
      language,
      body.lead_id,
      undefined,
    );
    const pendingResolution = asRecord(parserResponse.data.meta?.pendingActionResolution);
    const parserAppliedSlots = asRecord(pendingResolution?.applied);
    const stateAppliedSlots = asRecord(emiliaState.pending_action?.applied);
    const deterministicAppliedSlots = derivePendingAnswerSlots(
      emiliaState.pending_action as unknown as Record<string, unknown> | null,
      body.message,
      parsedRequest,
    );
    const resolvedSlots = {
      ...(stateAppliedSlots || {}),
      ...(parserAppliedSlots || {}),
      ...deterministicAppliedSlots,
    };
    const quoteTurnContext = resolveApiQuoteTurnContext({
      parsedRequest,
      persistentState,
      message: body.message,
      resolvedSlots,
    });
    parsedRequest = quoteTurnContext.parsedRequest;
    const iterationContext = quoteTurnContext.iterationContext;
    parsedRequest = normalizeSearchIntent(parsedRequest, new Date());

    const validation = validateParsedRequest(parsedRequest);
    const routeResult = routeRequest(parsedRequest, validation);
    const recentCollectCount = await countRecentCollects(supabase, conversationId);
    const conversationTurn = resolveConversationTurn({
      parsedRequest,
      routeResult,
      mode,
      hasPersistentContext: Boolean(contextualMemory || persistentState),
      hasPreviousParsedRequest: Boolean(previousContext),
      recentCollectCount,
      previousMessageType: String(previousAssistantMeta?.messageType || ''),
      hasPendingAction: Boolean(emiliaState.pending_action),
      iterationContext,
    });

    let searchResults: SearchResults | null = null;
    let searchTimeMs = 0;

    if (shouldExecuteApiQuoteSearch({
      route: routeResult.route,
      executionBranch: conversationTurn.executionBranch,
      requestType: parsedRequest.type,
      missingFields: routeResult.missingFields,
    })) {
      const searchStartedAt = Date.now();
      searchResults = await executeSearch(parsedRequest, supabase);
      searchTimeMs = Date.now() - searchStartedAt;
    }

    const pendingAction = conversationTurn.responseMode === 'needs_input'
      ? buildPendingAction(routeResult, parsedRequest, quoteTurnContext.appliedSlots)
      : null;

    emiliaState.pending_action = pendingAction;
    emiliaState.meta.turn_count = (emiliaState.meta.turn_count || 0) + 1;
    await saveEmiliaState(supabase, conversationId, apiKey.agency_id, emiliaState);

    const contextState = searchResults
      ? buildContextState(parsedRequest, searchResults, persistentState)
      : (conversationTurn.responseMode === 'needs_input'
        ? buildFailedValidationContextState(parsedRequest, persistentState)
        : persistentState);
    if (contextState && (searchResults || conversationTurn.responseMode === 'needs_input')) {
      await saveContextState(supabase, conversationId, contextState);
    }

    if (searchResults) {
      if (hasAnySearchResults(searchResults)) {
        await clearContextualMemory(supabase, conversationId);
      }
    }
    await persistTurnIntentSnapshot(supabase, conversationId, parsedRequest);

    const noResults = isNoResultsSearch(searchResults);
    const finalConversationTurn: ConversationTurn = noResults
      ? {
          ...conversationTurn,
          messageType: 'no_results',
          responseMode: 'quote_or_search',
          uiMeta: {
            ...conversationTurn.uiMeta,
            reason: 'search_completed_without_results',
          },
        }
      : conversationTurn;
    const combinedData = searchResults ? buildCombinedData(parsedRequest, searchResults) : undefined;
    const plannerData = buildPlannerData(searchResults);
    const recommendedPlaces = Array.isArray((parserResponse.data.meta?.placeDiscovery as Record<string, unknown> | null)?.places)
      ? (parserResponse.data.meta.placeDiscovery as Record<string, unknown>).places
      : undefined;
    const assistantText = buildAssistantText({
      parsedRequest,
      routeResult,
      conversationTurn: finalConversationTurn,
      searchResults,
      language,
    });

    const assistantMeta = {
      status: 'sent',
      source: 'AI_PARSER + EUROVIPS',
      runtime: 'emilia-turn',
      request_id: body.request_id,
      requestText: body.message,
      originalRequest: parsedRequest,
      parsedRequest,
      messageType: finalConversationTurn.messageType,
      responseMode: finalConversationTurn.responseMode,
      normalizedMissingFields: finalConversationTurn.normalizedMissingFields,
      emiliaRoute: routeResult,
      routeResult,
      conversationTurn: finalConversationTurn,
      responseLanguage: language,
      pendingAction,
      iterationContext,
      ...(noResults
        ? {
            noResults: {
              requestType: parsedRequest.type,
              flightsCount: searchResults?.flights?.count ?? 0,
              hotelsCount: searchResults?.hotels?.count ?? 0,
              searchStatus: searchResults?.status,
              suggestions: ['change_dates', 'change_destination', 'relax_filters'],
            },
          }
        : {}),
      slotResolution: {
        appliedSlots: quoteTurnContext.appliedSlots,
        sources: {
          parser: Boolean(parserAppliedSlots && Object.keys(parserAppliedSlots).length > 0),
          state: Boolean(stateAppliedSlots && Object.keys(stateAppliedSlots).length > 0),
          deterministic: Object.keys(deterministicAppliedSlots).length > 0,
        },
      },
      ...(combinedData ? { combinedData } : {}),
      ...(plannerData ? { plannerData, itineraryData: plannerData } : {}),
      ...(recommendedPlaces ? { recommendedPlaces, discoveryContext: parserResponse.data.meta?.placeDiscovery } : {}),
      parserMeta: parserResponse.data.meta || null,
      usage: parserResponse.data.usage || null,
      timings: {
        parse_time_ms: parseTimeMs,
        search_time_ms: searchTimeMs,
      },
      api: {
        source: 'api_emilia_turn',
        key_prefix: apiKey.key_prefix,
        external_conversation_ref: body.external_conversation_ref || null,
      },
    };

    const assistantMessage = await insertMessage(
      supabase,
      conversationId,
      'assistant',
      assistantText,
      assistantMeta,
    );

    return jsonResponse({
      success: true,
      request_id: body.request_id,
      conversation_id: conversationId,
      user_message: userMessage,
      assistant_message: assistantMessage,
      emilia: {
        parsed_request: parsedRequest,
        route_result: routeResult,
        conversation_turn: finalConversationTurn,
        pending_action: pendingAction,
        context_state: contextState,
      },
      metadata: {
        runtime: 'emilia-turn',
        parse_time_ms: parseTimeMs,
        search_time_ms: searchTimeMs,
        total_time_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error('[EMILIA_TURN] error:', error);
    if (error instanceof HttpError) return errorResponse(error);
    return errorResponse(new HttpError('INTERNAL_ERROR', 'Internal server error', 500));
  }
});
