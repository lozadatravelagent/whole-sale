import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { executeSearch } from '../_shared/searchExecutor.ts';
import { validateParsedRequest } from '../_shared/validation.ts';
import type { ParsedRequest, SearchResults } from '../_shared/contextManagement.ts';
import { renderStateForSystemPrompt } from '../_shared/renderState.ts';
import { SCHEMA_VERSION, type EmiliaState, type PendingAction } from '../_shared/emiliaStateTypes.ts';

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
  messageType: 'collect_question' | 'missing_info_request' | 'trip_planner' | 'search_results' | 'general_response' | 'discovery_results' | 'mode_bridge' | 'search_proposal';
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

  const missingFields = validation.missingFields.map((f) => f.field);

  if (parsed.type === 'itinerary') {
    return {
      route: validation.isValid ? 'PLAN' : 'COLLECT',
      score,
      dimensions,
      missingFields,
      inferredFields: [],
      collectQuestion: validation.message || parsed.message,
      reason: validation.isValid ? 'itinerary_request' : 'needs_clarification',
    };
  }

  if (parsed.type === 'missing_info_request' || !validation.isValid) {
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields: missingFields.length > 0 ? missingFields : (parsed.missingFields || []),
      inferredFields: [],
      collectQuestion: parsed.message || validation.message,
      reason: 'needs_clarification',
    };
  }

  if (['flights', 'hotels', 'combined', 'packages', 'services', 'activities', 'transfers'].includes(parsed.type)) {
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
    route: 'PLAN',
    score,
    dimensions,
    missingFields,
    inferredFields: [],
    reason: 'low_definition',
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
}): ConversationTurn {
  const { parsedRequest, routeResult, mode, recentCollectCount, previousMessageType, hasPendingAction } = options;
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

  const bridgeBlocked = previousMessageType === 'mode_bridge' || previousMessageType === 'quote_active_plan' || Boolean(hasPendingAction) || llmIteration || explicitPlanIntent;
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

  if (mode === 'passenger' || routeResult.route === 'PLAN') {
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

function buildPendingAction(routeResult: RouteResult, parsedRequest: ParsedRequest): PendingAction | null {
  const fields = routeResult.missingFields.map(normalizeMissingField).filter(Boolean);
  if (fields.length === 0) return null;
  return {
    kind: 'awaiting_user_input',
    for: parsedRequest.type === 'itinerary' ? 'itinerary' : 'quote',
    fields,
    prompt: routeResult.collectQuestion || parsedRequest.message || 'Necesito un dato mas para avanzar.',
    issuedAt: new Date().toISOString(),
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

  const flightsCount = searchResults?.flights?.count ?? 0;
  const hotelsCount = searchResults?.hotels?.count ?? 0;
  if (flightsCount > 0 && hotelsCount > 0) return `Encontre ${flightsCount} opciones de vuelo y ${hotelsCount} hoteles para esta busqueda.`;
  if (flightsCount > 0) return `Encontre ${flightsCount} opciones de vuelo para esta busqueda.`;
  if (hotelsCount > 0) return `Encontre ${hotelsCount} hoteles para esta busqueda.`;
  return 'Procese la solicitud y deje el resultado guardado en la conversacion.';
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
    const mode = body.mode || 'agency';
    const workspaceMode = body.workspace_mode || 'standard';
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
      language,
      external_conversation_ref: body.external_conversation_ref || null,
    });

    const [persistentState, previousAssistantMeta] = await Promise.all([
      loadContextState(supabase, conversationId),
      loadPreviousAssistantMeta(supabase, conversationId),
    ]);

    const emiliaState = await loadOrBootstrapEmiliaState(
      supabase,
      conversationId,
      apiKey,
      mode,
      language,
      body.lead_id,
      body.planner_state,
    );
    const memoryStateBlock = renderStateForSystemPrompt(emiliaState);
    const conversationHistory = await loadConversationHistory(supabase, conversationId, userMessage.id);
    const previousContext = contextStateToPreviousRequest(persistentState);

    const parseStartedAt = Date.now();
    const parserResponse = await supabase.functions.invoke('ai-message-parser', {
      body: {
        message: body.message,
        language,
        currentDate: new Date().toISOString().slice(0, 10),
        previousContext,
        conversationHistory,
        plannerContext: body.planner_state || null,
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

    const parsedRequest = normalizeParsed(parserResponse.data.parsed || {});
    const validation = validateParsedRequest(parsedRequest);
    const routeResult = routeRequest(parsedRequest, validation);
    const recentCollectCount = await countRecentCollects(supabase, conversationId);
    const conversationTurn = resolveConversationTurn({
      parsedRequest,
      routeResult,
      mode,
      hasPersistentContext: Boolean(persistentState),
      hasPreviousParsedRequest: Boolean(previousContext),
      recentCollectCount,
      previousMessageType: String(previousAssistantMeta?.messageType || ''),
      hasPendingAction: Boolean(emiliaState.pending_action),
    });

    let searchResults: SearchResults | null = null;
    let searchTimeMs = 0;

    if (
      conversationTurn.executionBranch === 'standard_search' ||
      conversationTurn.executionBranch === 'standard_itinerary'
    ) {
      if (!validation.isValid) {
        routeResult.route = 'COLLECT';
      } else if (parsedRequest.type !== 'general') {
        const searchStartedAt = Date.now();
        searchResults = await executeSearch(parsedRequest, supabase);
        searchTimeMs = Date.now() - searchStartedAt;
      }
    }

    const pendingAction = conversationTurn.responseMode === 'needs_input'
      ? buildPendingAction(routeResult, parsedRequest)
      : null;

    emiliaState.pending_action = pendingAction;
    emiliaState.meta.turn_count = (emiliaState.meta.turn_count || 0) + 1;
    await saveEmiliaState(supabase, conversationId, apiKey.agency_id, emiliaState);

    const contextState = searchResults
      ? buildContextState(parsedRequest, searchResults, persistentState)
      : persistentState;
    if (contextState && searchResults) {
      await saveContextState(supabase, conversationId, contextState);
    }

    const combinedData = searchResults ? buildCombinedData(parsedRequest, searchResults) : undefined;
    const plannerData = buildPlannerData(searchResults);
    const recommendedPlaces = Array.isArray((parserResponse.data.meta?.placeDiscovery as Record<string, unknown> | null)?.places)
      ? (parserResponse.data.meta.placeDiscovery as Record<string, unknown>).places
      : undefined;
    const assistantText = buildAssistantText({
      parsedRequest,
      routeResult,
      conversationTurn,
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
      messageType: conversationTurn.messageType,
      responseMode: conversationTurn.responseMode,
      normalizedMissingFields: conversationTurn.normalizedMissingFields,
      emiliaRoute: routeResult,
      routeResult,
      conversationTurn,
      responseLanguage: language,
      pendingAction,
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
        conversation_turn: conversationTurn,
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
