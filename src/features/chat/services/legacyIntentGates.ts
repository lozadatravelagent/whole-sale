/**
 * Legacy intent gate registry.
 *
 * Pre-Emilia client-side gates that intercept specific intents before the
 * standard parser → router → orchestrator → Context Engineering pipeline
 * runs. Today there are three: cheaper-flights search, add-hotel coercion,
 * and price-change requests against an analyzed PDF.
 *
 * The registry replaces the ~180-line if-chain that used to live in
 * `useMessageHandler.handleSendMessage` (commit before this one).
 *
 * Spec: docs/superpowers/specs/2026-05-19-legacy-intent-gate-registry-design.md
 *
 * Contract summary:
 *  - `matches(message)` decides if a gate is a candidate for this message.
 *  - `precondition(ctx)` (sync or async) decides whether the gate's
 *    underlying resource is actually available. When false, the runner
 *    continues to the next gate — silent fall-through to Emilia, never
 *    a swallowed message or dead-end response.
 *  - `run(ctx)` returns `'handled'` when the gate has produced the user
 *    visible side-effect for this turn, or `'fallthrough'` when an
 *    internal soft error means Emilia should take over (today: add_hotel).
 *    This is a refinement of the spec's `Promise<void>` — needed to
 *    preserve add_hotel's existing catch/fall-through.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';

import type { ContextState } from '../types/contextState';
import {
  isAddHotelRequest,
  isCheaperFlightRequest,
  isPriceChangeRequest,
} from '../utils/intentDetection';

export type GateOutcome = 'handled' | 'fallthrough';

export interface GateContext {
  conversationId: string;
  message: string;
  lastPdfAnalysis: { conversationId?: string } | null;
  loadContextState: (conversationId: string) => Promise<ContextState | null>;
  setMessage: (message: string) => void;
  setIsLoading: (loading: boolean) => void;
  setIsTyping: (typing: boolean, conversationId?: string | null) => void;
  setTypingMessage: (message: string, conversationId?: string | null) => void;
  typingCopy: {
    changingPrice: string;
    generatingPdf: string;
    [k: string]: unknown;
  };
  addOptimisticMessage: (message: unknown) => void;
  saveAndDisplayMessage: (message: unknown) => Promise<unknown>;
  handleCheaperFlightsSearch: (message: string) => Promise<string | null>;
  handlePriceChangeRequest: (
    message: string,
  ) => Promise<{ response: string; modifiedPdfUrl?: string } | null>;
  handleHotelSearch: (request: ParsedTravelRequest) => Promise<{
    response: string;
    data?: Record<string, unknown> | null;
  }>;
  saveContextualMemory: (
    conversationId: string,
    request: ParsedTravelRequest,
  ) => Promise<void>;
  detectHotelPreferencesFromMessage: (
    parsed: ParsedTravelRequest | null,
    message: string,
  ) => {
    hotelChains: string[];
    roomType?: string;
    mealPlan?: string;
  };
  searchStayNights: number;
  userLanguage: string;
  toast: (args: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
  t: (key: string) => string;
}

export interface LegacyIntentGate {
  name: 'cheaper_flights' | 'add_hotel' | 'price_change';
  matches(message: string): boolean;
  precondition(ctx: GateContext): boolean | Promise<boolean>;
  run(ctx: GateContext): Promise<GateOutcome>;
}

export async function runGates(
  gates: readonly LegacyIntentGate[],
  message: string,
  ctx: GateContext,
): Promise<GateOutcome> {
  // The runner owns the link between the matched `message` and the value
  // each gate sees in `ctx.message` — call-sites only have to thread the
  // message once.
  const runCtx: GateContext = { ...ctx, message };
  for (const gate of gates) {
    if (!gate.matches(message)) continue;
    const ok = await gate.precondition(runCtx);
    if (!ok) continue;
    const outcome = await gate.run(runCtx);
    if (outcome === 'handled') return 'handled';
    // outcome === 'fallthrough' → keep looking; if no later gate handles,
    // the runner ultimately returns 'fallthrough' so Emilia takes over.
  }
  return 'fallthrough';
}

const hasMatchingPdf = (ctx: GateContext): boolean =>
  ctx.lastPdfAnalysis?.conversationId === ctx.conversationId;

/* -------------------------------------------------------------------------- */
/*  cheaper_flights                                                           */
/* -------------------------------------------------------------------------- */

const cheaperFlightsGate: LegacyIntentGate = {
  name: 'cheaper_flights',
  matches: isCheaperFlightRequest,
  precondition: hasMatchingPdf,
  run: async (ctx) => {
    console.log(
      '✈️ [CHEAPER FLIGHTS] Detected cheaper flights search request for previous PDF',
    );

    ctx.setMessage('');
    ctx.setIsLoading(true);

    try {
      const clientId = crypto.randomUUID();
      console.log('🔑 [CHEAPER FLIGHTS] Generated client_id:', clientId);

      const optimisticUserMessage = {
        id: `temp-${clientId}`,
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sending',
          client_id: clientId,
          messageType: 'cheaper_flights_request',
        },
        created_at: new Date().toISOString(),
      };
      ctx.addOptimisticMessage(optimisticUserMessage);

      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sent',
          messageType: 'cheaper_flights_request',
          client_id: clientId,
        },
      });

      const responseMessage = await ctx.handleCheaperFlightsSearch(ctx.message);

      if (responseMessage) {
        await ctx.saveAndDisplayMessage({
          conversation_id: ctx.conversationId,
          role: 'assistant' as const,
          content: {
            text: responseMessage,
            metadata: {
              type: 'cheaper_flights_search',
              originalRequest: ctx.message,
            },
          },
          meta: {
            status: 'sent',
            messageType: 'cheaper_flights_response',
          },
        });
      }
    } catch (error) {
      console.error('❌ Error searching for cheaper flights:', error);
      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'assistant' as const,
        content: {
          text:
            '❌ **Error en la búsqueda de vuelos**\n\nNo pude buscar vuelos alternativos en este momento. Esto puede deberse a:\n\n• Problemas temporales con el servicio de búsqueda\n• El PDF no contiene información de vuelos válida\n• Error de conectividad\n\n¿Podrías intentarlo nuevamente o proporcionarme manualmente los detalles del vuelo?',
        },
        meta: { status: 'sent', messageType: 'error_response' },
      });
    } finally {
      ctx.setIsLoading(false);
    }

    return 'handled';
  },
};

/* -------------------------------------------------------------------------- */
/*  add_hotel                                                                 */
/* -------------------------------------------------------------------------- */

const addHotelGate: LegacyIntentGate = {
  name: 'add_hotel',
  matches: isAddHotelRequest,
  precondition: async (ctx) => {
    const state = await ctx.loadContextState(ctx.conversationId);
    return Boolean(state?.lastSearch?.flightsParams);
  },
  run: async (ctx) => {
    // Precondition guaranteed flightsParams exists; re-load is cheap and
    // keeps the gate self-contained without leaking state through the
    // GateContext.
    const persistentState = await ctx.loadContextState(ctx.conversationId);
    const flightCtx = persistentState?.lastSearch?.flightsParams;
    if (!flightCtx) {
      // Defensive: precondition said yes, but state went away between
      // checks. Fall through to Emilia rather than crash.
      console.warn(
        '⚠️ [INTENT] add_hotel precondition was true but flight context vanished — falling through',
      );
      return 'fallthrough';
    }

    const hotelPreferences = ctx.detectHotelPreferencesFromMessage(null, ctx.message);
    console.log('🏨 [INTENT] Add hotel detected, reusing flight context for combined search');
    console.log('🏨 [INTENT] Flight context:', flightCtx);

    ctx.setMessage('');
    ctx.setIsLoading(true);

    try {
      const clientId = crypto.randomUUID();
      console.log('🔑 [ADD HOTEL] Generated client_id:', clientId);

      ctx.addOptimisticMessage({
        id: `temp-${clientId}`,
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sending',
          client_id: clientId,
          messageType: 'add_hotel_intent',
        },
        created_at: new Date().toISOString(),
      });

      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sent',
          messageType: 'add_hotel_intent',
          client_id: clientId,
        },
      });

      const checkoutFallback = new Date(
        new Date(flightCtx.departureDate).getTime() +
          ctx.searchStayNights * 86400000,
      )
        .toISOString()
        .split('T')[0];

      const hotelsParsed: ParsedTravelRequest = {
        requestType: 'hotels',
        hotels: {
          city: flightCtx.destination,
          checkinDate: flightCtx.departureDate,
          checkoutDate: flightCtx.returnDate || checkoutFallback,
          adults: flightCtx.adults,
          children: flightCtx.children,
          infants: flightCtx.infants,
          ...(hotelPreferences.roomType ? { roomType: hotelPreferences.roomType } : {}),
          ...(hotelPreferences.mealPlan ? { mealPlan: hotelPreferences.mealPlan } : {}),
          ...(hotelPreferences.hotelChains.length > 0
            ? { hotelChains: hotelPreferences.hotelChains }
            : {}),
        },
        confidence: 0.9,
        originalMessage: ctx.message,
      } as unknown as ParsedTravelRequest;

      console.log('🏨 [INTENT] Hotel request built:', {
        city: hotelsParsed.hotels?.city,
        checkinDate: hotelsParsed.hotels?.checkinDate,
        checkoutDate: hotelsParsed.hotels?.checkoutDate,
        adults: hotelsParsed.hotels?.adults,
      });

      await ctx.saveContextualMemory(ctx.conversationId, hotelsParsed);

      const hotelResult = await ctx.handleHotelSearch(hotelsParsed);

      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'assistant' as const,
        content: { text: hotelResult.response },
        meta: hotelResult.data
          ? { ...hotelResult.data, responseLanguage: ctx.userLanguage }
          : { responseLanguage: ctx.userLanguage },
      });

      ctx.setMessage('');
      ctx.setIsLoading(false);
      return 'handled';
    } catch (err) {
      console.error('❌ [INTENT] Add hotel flow failed:', err);
      ctx.setIsLoading(false);
      return 'fallthrough';
    }
  },
};

/* -------------------------------------------------------------------------- */
/*  price_change                                                              */
/* -------------------------------------------------------------------------- */

const priceChangeGate: LegacyIntentGate = {
  name: 'price_change',
  matches: isPriceChangeRequest,
  precondition: hasMatchingPdf,
  run: async (ctx) => {
    console.log('💰 [PRICE CHANGE] Detected price change request for previous PDF');

    ctx.setMessage('');
    ctx.setIsLoading(true);

    try {
      const clientId = crypto.randomUUID();
      console.log('🔑 [PRICE CHANGE] Generated client_id:', clientId);

      ctx.addOptimisticMessage({
        id: `temp-${clientId}`,
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sending',
          client_id: clientId,
          messageType: 'price_change_request',
        },
        created_at: new Date().toISOString(),
      });

      ctx.setIsTyping(true, ctx.conversationId);
      ctx.setTypingMessage(ctx.typingCopy.changingPrice, ctx.conversationId);

      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'user' as const,
        content: { text: ctx.message.trim() },
        meta: {
          status: 'sent',
          messageType: 'price_change_request',
          client_id: clientId,
        },
      });

      ctx.setTypingMessage(ctx.typingCopy.generatingPdf, ctx.conversationId);

      const result = await ctx.handlePriceChangeRequest(ctx.message);

      // Precondition guaranteed a matching PDF, but handlePriceChangeRequest
      // can still return null if state went away between checks. Defensive
      // fall-through rather than the old hard dead-end message.
      if (!result) {
        console.warn(
          '⚠️ [PRICE CHANGE] PDF context vanished between precondition and run — falling through',
        );
        return 'fallthrough';
      }

      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'assistant' as const,
        content: {
          text: result.response,
          pdfUrl: result.modifiedPdfUrl,
          metadata: {
            type: 'price_change_response',
            hasModifiedPdf: !!result.modifiedPdfUrl,
          },
        },
        meta: {
          status: 'sent',
          messageType: result.modifiedPdfUrl
            ? 'pdf_generated'
            : 'price_change_response',
        },
      });

      if (result.modifiedPdfUrl) {
        ctx.toast({
          title: ctx.t('toasts.pdfModified.title'),
          description: ctx.t('toasts.pdfModified.description'),
        });
      }
    } catch (error) {
      console.error('❌ Error processing price change request:', error);
      await ctx.saveAndDisplayMessage({
        conversation_id: ctx.conversationId,
        role: 'assistant' as const,
        content: {
          text:
            '❌ **Error al procesar cambio de precio**\n\nNo pude procesar tu solicitud de cambio de precio. Por favor, verifica que:\n\n• El PDF esté correctamente analizado\n• El precio que indicaste sea un número válido\n• Intenta nuevamente en unos momentos',
        },
        meta: { status: 'sent', messageType: 'error_response' },
      });
      ctx.toast({
        title: ctx.t('toasts.priceChangeFailed.title'),
        description: ctx.t('toasts.priceChangeFailed.description'),
        variant: 'destructive',
      });
    } finally {
      ctx.setTypingMessage('', ctx.conversationId);
      ctx.setIsTyping(false, ctx.conversationId);
      ctx.setIsLoading(false);
    }

    return 'handled';
  },
};

export const LEGACY_INTENT_GATES: readonly LegacyIntentGate[] = [
  cheaperFlightsGate,
  addHotelGate,
  priceChangeGate,
] as const;

export function runLegacyIntentGates(
  message: string,
  ctx: GateContext,
): Promise<GateOutcome> {
  return runGates(LEGACY_INTENT_GATES, message, ctx);
}
